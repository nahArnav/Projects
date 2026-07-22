from __future__ import annotations

import gc
import gzip
import inspect
import io
import math
import os
import pickle
import bz2
import lzma
from dataclasses import dataclass
from pathlib import Path
from tempfile import SpooledTemporaryFile
from typing import Any
from xml.etree import ElementTree

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile

from .feature_analysis import score_from_raw_prediction
from .feature_catalog import DEFAULT_AUDITOR_FEATURES, is_sensitive_feature, sanitize_key

try:
    import onnxruntime as ort
except ImportError:  # pragma: no cover
    ort = None


ALLOW_UNSAFE_SERIALIZED_MODELS = os.getenv("RAYCTIFY_ALLOW_UNSAFE_SERIALIZED_MODELS", "1") == "1"
RAYCTIFIED_TYPE_MARKERS = ("thresholdoptimizer", "rayctified", "interceptor", "postprocess", "wrapper", "mitigat", "debias", "fairness", "healer", "unbiased")
SENSITIVE_PARAMETER_MARKERS = ("sensitive", "protected", "demographic")
SENSITIVE_FALLBACK_FEATURES = [feature_name for feature_name in DEFAULT_AUDITOR_FEATURES if is_sensitive_feature(feature_name)]
MODEL_REJECT_FLOOR = 0.45
MODEL_ACCEPT_THRESHOLD = 0.50


@dataclass
class LoadedModel:
    model: Any
    engine: str
    feature_names: list[str]
    feature_aliases: dict[str, str]
    model_type: str = "standard"

    def predict_many(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if self.engine == "onnx":
            return _predict_onnx(self.model, self.feature_names, records)
        if self.engine == "pmml-heuristic":
            return _predict_pmml_heuristic(self.feature_names, records)
        if self.model_type == "rayctified":
            return _predict_rayctified_like(self.model, self.feature_names, self.feature_aliases, records)
        return _predict_sklearn_like(self.model, self.feature_names, self.feature_aliases, records)

    def dispose(self) -> None:
        self.model = None
        self.feature_names = []
        self.feature_aliases = {}
        gc.collect()


def _normalize_feature_bindings(feature_names: list[str]) -> tuple[list[str], dict[str, str]]:
    normalized: list[str] = []
    aliases: dict[str, str] = {}
    used: dict[str, int] = {}

    for index, raw_name in enumerate(feature_names):
        base_key = sanitize_key(raw_name) or f"feature_{index + 1}"
        collision_count = used.get(base_key, 0)
        final_key = f"{base_key}_{collision_count + 1}" if collision_count else base_key
        used[base_key] = collision_count + 1
        normalized.append(final_key)
        aliases[final_key] = str(raw_name)

    return normalized, aliases


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()

    for value in values:
        key = str(value).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(key)

    return deduped


def _dedupe_preserve_normalized_order(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()

    for value in values:
        raw_value = str(value).strip()
        if not raw_value:
            continue

        normalized_key = sanitize_key(raw_value)
        if normalized_key in seen:
            continue

        seen.add(normalized_key)
        deduped.append(raw_value)

    return deduped


def _coerce_name_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, (str, bytes)):
        return [str(value)]

    try:
        raw_values = list(value)
    except TypeError:
        return []

    return _dedupe_preserve_order([str(item) for item in raw_values if str(item).strip()])


def _iter_model_carriers(model: Any) -> list[Any]:
    carriers = [
        model,
        getattr(model, "estimator_", None),
        getattr(model, "estimator", None),
        getattr(model, "base_estimator_", None),
        getattr(model, "base_estimator", None),
        getattr(model, "model", None),
        getattr(model, "base_model", None),  # Deep X-Ray: Catch older RayCtify wrappers
        getattr(model, "_engine", None),     # Deep X-Ray: Catch dynamic properties
    ]
    deduped: list[Any] = []
    seen: set[int] = set()

    for carrier in carriers:
        if carrier is None or id(carrier) in seen:
            continue
        seen.add(id(carrier))
        deduped.append(carrier)

    return deduped


def _extract_model_feature_names(model: Any) -> list[str]:
    for carrier in _iter_model_carriers(model):
        for attribute_name in ("feature_names_in_", "feature_names_", "input_features_"):
            names = _coerce_name_list(getattr(carrier, attribute_name, None))
            if names:
                return names
    return []


def _extract_model_feature_count(model: Any) -> int | None:
    for carrier in _iter_model_carriers(model):
        raw_count = getattr(carrier, "n_features_in_", None)
        if isinstance(raw_count, (int, np.integer)):
            return int(raw_count)
    return None


def _extract_sensitive_feature_names(model: Any) -> list[str]:
    for carrier in _iter_model_carriers(model):
        for attribute_name in (
            "sensitive_feature_names_in_",
            "sensitive_feature_names_",
            "sensitive_feature_names",
            "protected_feature_names_",
            "protected_feature_names",
            "protected_attribute_names_",
            "protected_attribute_names",
        ):
            names = _coerce_name_list(getattr(carrier, attribute_name, None))
            if names:
                return names
    return []


def _predict_accepts_sensitive_features(model: Any) -> bool:
    predict = getattr(model, "predict", None)
    if predict is None:
        return False

    try:
        parameters = list(inspect.signature(predict).parameters.values())
    except (TypeError, ValueError):
        return False

    for parameter in parameters[1:]:
        normalized_name = parameter.name.lower()
        if normalized_name == "a" or any(marker in normalized_name for marker in SENSITIVE_PARAMETER_MARKERS):
            return True

    return False


def detect_model_type(model: Any) -> str:
    if getattr(model, "is_rayctified", False) or hasattr(model, "mitigate"):
        return "rayctified"

    type_name = type(model).__name__.lower()
    module_name = type(model).__module__.lower()

    if _predict_accepts_sensitive_features(model):
        return "rayctified"
    if "fairlearn" in module_name:
        return "rayctified"
    if any(marker in type_name for marker in RAYCTIFIED_TYPE_MARKERS):
        return "rayctified"
    if "rayctify" in module_name:
        return "rayctified"
    return "standard"


def _resolve_serialized_feature_names(model: Any, model_type: str) -> list[str]:
    feature_names = _extract_model_feature_names(model)
    if not feature_names:
        feature_names = _fallback_feature_names(_extract_model_feature_count(model))

    if model_type == "rayctified":
        sensitive_feature_names = _extract_sensitive_feature_names(model) or list(SENSITIVE_FALLBACK_FEATURES)
        feature_names = _dedupe_preserve_order([*feature_names, *sensitive_feature_names])

    return feature_names


def _fallback_feature_names(count: int | None = None) -> list[str]:
    if not count:
        return list(DEFAULT_AUDITOR_FEATURES)

    names = list(DEFAULT_AUDITOR_FEATURES[:count])
    while len(names) < count:
        names.append(f"feature_{len(names) + 1}")
    return names


def _frame_for_records(records: list[dict[str, Any]], feature_names: list[str], feature_aliases: dict[str, str]) -> pd.DataFrame:
    data = {}

    for feature_name in feature_names:
        data[feature_aliases.get(feature_name, feature_name)] = [record.get(feature_name, 0) for record in records]

    return pd.DataFrame(data)


def _decision_from_score(score: float) -> str:
    normalized_score = float(score)
    if normalized_score < MODEL_REJECT_FLOOR:
        return "REJECTED"
    if normalized_score >= MODEL_ACCEPT_THRESHOLD:
        return "ACCEPTED"
    return "REJECTED"


def _format_prediction_scores(scores: list[float]) -> list[dict[str, Any]]:
    return [{"score": round(score, 4), "decision": _decision_from_score(score)} for score in scores]


def _split_feature_frames(
    records: list[dict[str, Any]], feature_names: list[str], feature_aliases: dict[str, str]
) -> tuple[pd.DataFrame, pd.Series | pd.DataFrame | None]:
    model_feature_names: list[str] = []
    sensitive_feature_names: list[str] = []

    for feature_name in feature_names:
        display_name = feature_aliases.get(feature_name, feature_name)
        if is_sensitive_feature(feature_name) or is_sensitive_feature(display_name):
            sensitive_feature_names.append(feature_name)
        else:
            model_feature_names.append(feature_name)

    if not model_feature_names:
        model_feature_names = list(feature_names)

    feature_frame = _frame_for_records(records, model_feature_names, feature_aliases)
    if not sensitive_feature_names:
        return feature_frame, None

    sensitive_frame = _frame_for_records(records, sensitive_feature_names, feature_aliases)
    if sensitive_frame.shape[1] == 1:
        return feature_frame, sensitive_frame.iloc[:, 0]

    return feature_frame, sensitive_frame


def _call_model_method_with_sensitive_features(method: Any, features: Any, sensitive_input: Any) -> Any:
    if sensitive_input is None:
        return method(features)

    try:
        parameters = list(inspect.signature(method).parameters.values())
    except (TypeError, ValueError):
        parameters = []

    sensitive_parameter_name: str | None = None
    for parameter in parameters[1:]:
        normalized_name = parameter.name.lower()
        if normalized_name == "a" or any(marker in normalized_name for marker in SENSITIVE_PARAMETER_MARKERS):
            sensitive_parameter_name = parameter.name
            break

    if sensitive_parameter_name == "a":
        return method(features, sensitive_input)
    if sensitive_parameter_name:
        return method(features, **{sensitive_parameter_name: sensitive_input})
    return method(features, sensitive_features=sensitive_input)


def _scores_from_probabilities(probabilities: Any) -> list[float]:
    values = np.asarray(probabilities)
    if values.ndim == 2:
        return [float(row[-1]) for row in values]
    return [score_from_raw_prediction(value) for value in values.reshape(-1)]


def _predict_sklearn_like(
    model: Any, feature_names: list[str], feature_aliases: dict[str, str], records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    frame = _frame_for_records(records, feature_names, feature_aliases)

    try:
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(frame)
            scores = [float(row[-1]) for row in np.asarray(probabilities)]
        elif hasattr(model, "decision_function"):
            raw_scores = np.asarray(model.decision_function(frame)).reshape(-1)
            scores = [float(1 / (1 + math.exp(-score))) for score in raw_scores]
        else:
            predictions = model.predict(frame)
            scores = [score_from_raw_prediction(value) for value in np.asarray(predictions).reshape(-1)]
    except Exception:
        predictions = model.predict(frame.to_numpy())
        scores = [score_from_raw_prediction(value) for value in np.asarray(predictions).reshape(-1)]

    return _format_prediction_scores(scores)


def _predict_rayctified_like(
    model: Any, feature_names: list[str], feature_aliases: dict[str, str], records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    feature_frame, sensitive_input = _split_feature_frames(records, feature_names, feature_aliases)

    if sensitive_input is None:
        try:
            if hasattr(model, "predict_proba"):
                probabilities = model.predict_proba(feature_frame)
                return _format_prediction_scores(_scores_from_probabilities(probabilities))
            predictions = model.predict(feature_frame)
            scores = [score_from_raw_prediction(value) for value in np.asarray(predictions).reshape(-1)]
            return _format_prediction_scores(scores)
        except Exception:
            try:
                if hasattr(model, "predict_proba"):
                    probabilities = model.predict_proba(feature_frame.to_numpy())
                    return _format_prediction_scores(_scores_from_probabilities(probabilities))
                predictions = model.predict(feature_frame.to_numpy())
                scores = [score_from_raw_prediction(value) for value in np.asarray(predictions).reshape(-1)]
                return _format_prediction_scores(scores)
            except Exception:
                return _predict_sklearn_like(model, feature_names, feature_aliases, records)

    candidate_inputs = [
        (feature_frame, sensitive_input),
        (
            feature_frame.to_numpy(),
            sensitive_input.to_numpy() if hasattr(sensitive_input, "to_numpy") else np.asarray(sensitive_input),
        ),
    ]
    errors: list[str] = []

    for features_payload, sensitive_payload in candidate_inputs:
        predict_proba = getattr(model, "predict_proba", None)
        if callable(predict_proba):
            try:
                probabilities = _call_model_method_with_sensitive_features(
                    predict_proba, features_payload, sensitive_payload
                )
                return _format_prediction_scores(_scores_from_probabilities(probabilities))
            except Exception as exc:
                errors.append(f"predict_proba: {exc}")

        try:
            predictions = _call_model_method_with_sensitive_features(model.predict, features_payload, sensitive_payload)
            scores = [score_from_raw_prediction(value) for value in np.asarray(predictions).reshape(-1)]
            return _format_prediction_scores(scores)
        except Exception as exc:
            errors.append(f"predict: {exc}")

    from fastapi import HTTPException
    raise HTTPException(
        status_code=400,
        detail="Unable to evaluate the RayCtified wrapper with sensitive-feature routing: " + "; ".join(errors),
    )


def _coerce_onnx_input(records: list[dict[str, Any]], feature_names: list[str]) -> np.ndarray:
    matrix = []
    for record in records:
        row = []
        for feature_name in feature_names:
            try:
                row.append(float(record.get(feature_name, 0)))
            except (TypeError, ValueError):
                row.append(0.0)
        matrix.append(row)
    return np.asarray(matrix, dtype=np.float32)


def _extract_onnx_scores(outputs: list[Any], record_count: int) -> list[float]:
    for output in outputs:
        if isinstance(output, np.ndarray):
            if output.ndim == 2 and output.shape[0] == record_count:
                if output.shape[1] > 1:
                    return [float(row[-1]) for row in output]
                return [score_from_raw_prediction(row[0]) for row in output]
            if output.ndim == 1 and output.shape[0] == record_count:
                return [score_from_raw_prediction(value) for value in output]

        if isinstance(output, list) and len(output) == record_count:
            if output and isinstance(output[0], dict):
                return [float(max(item.values())) for item in output]
            return [score_from_raw_prediction(value) for value in output]

    return [0.5] * record_count


def _predict_onnx(model: Any, feature_names: list[str], records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if ort is None:
        raise HTTPException(status_code=500, detail="onnxruntime is not installed on the backend.")

    model_input = model.get_inputs()[0]
    input_array = _coerce_onnx_input(records, feature_names)
    outputs = model.run(None, {model_input.name: input_array})
    scores = _extract_onnx_scores(outputs, len(records))
    return _format_prediction_scores(scores)


def _pmml_schema_from_bytes(model_bytes: bytes) -> list[str]:
    root = ElementTree.fromstring(model_bytes)
    namespaces = {"pmml": root.tag.split("}")[0].strip("{")} if "}" in root.tag else {}
    fields = root.findall(".//pmml:MiningField", namespaces) if namespaces else root.findall(".//MiningField")
    feature_names = [field.attrib.get("name", "") for field in fields if field.attrib.get("usageType", "active") == "active"]
    return _dedupe_preserve_normalized_order([name for name in feature_names if name])


def _predict_pmml_heuristic(feature_names: list[str], records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for record in records:
        score = 0.52
        for feature_name in feature_names:
            value = record.get(feature_name, 0)
            normalized = sanitize_key(feature_name)
            try:
                numeric = float(value)
                centered = max(-1.0, min(1.0, (numeric - 50) / 50))
            except (TypeError, ValueError):
                centered = -0.25 if "redlined" in str(value).lower() else 0.15

            score += centered * (0.05 if "income" in normalized or "credit" in normalized else 0.03)

        score = max(0.01, min(0.99, score))
        results.append({"score": round(score, 4), "decision": _decision_from_score(score)})
    return results


def _load_serialized_model_from_file(file_obj: SpooledTemporaryFile, suffix: str) -> Any:
    del suffix

    strategies = [
        ("joblib", joblib.load),
        ("pickle", pickle.load),
        ("pickle-latin1", lambda stream: pickle.load(stream, encoding="latin1")),
        ("pickle-bytes", lambda stream: pickle.load(stream, encoding="bytes")),
    ]

    errors: list[str] = []

    for label, loader in strategies:
        try:
            file_obj.seek(0)
            return loader(file_obj)
        except Exception as exc:
            errors.append(f"{label}: {exc}")

    file_obj.seek(0)
    raw_bytes = file_obj.read()
    compression_strategies = [
        ("gzip", gzip.decompress),
        ("bz2", bz2.decompress),
        ("lzma", lzma.decompress),
    ]

    for compression_label, decompressor in compression_strategies:
        try:
            decompressed_bytes = decompressor(raw_bytes)
        except Exception as exc:
            errors.append(f"{compression_label}: {exc}")
            continue

        for loader_label, loader in strategies:
            stream = io.BytesIO(decompressed_bytes)
            try:
                return loader(stream)
            except Exception as exc:
                errors.append(f"{compression_label}-{loader_label}: {exc}")

    raise ValueError("; ".join(errors))


async def load_model_from_upload(upload_file: UploadFile) -> LoadedModel:
    suffix = Path(upload_file.filename or "").suffix.lower()

    try:
        if suffix in {".pkl", ".pickle", ".joblib"}:
            if not ALLOW_UNSAFE_SERIALIZED_MODELS:
                raise HTTPException(
                    status_code=400,
                    detail="Pickle and joblib model uploads are disabled. Enable them only inside an isolated sandbox.",
                )

            # Keep the file in binary mode and let joblib/pickle consume the raw upload stream directly.
            await upload_file.seek(0)
            raw_model = _load_serialized_model_from_file(upload_file.file, suffix)
            
            # Inspect the unpickled Python object for Interceptor/Wrapper
            class_name = getattr(raw_model, "__class__", type(raw_model)).__name__
            is_wrapper = (
                "Interceptor" in class_name or
                "Wrapper" in class_name or
                "RayCtified" in class_name or
                hasattr(raw_model, "is_rayctified") or
                hasattr(raw_model, "mitigate") or
                hasattr(raw_model, "predict_mitigated")
            )
            
            model_type = "rayctified" if is_wrapper else detect_model_type(raw_model)
            
            feature_names = _resolve_serialized_feature_names(raw_model, model_type)
            normalized_names, aliases = _normalize_feature_bindings(feature_names)
            return LoadedModel(raw_model, "sklearn-compatible", normalized_names, aliases, model_type=model_type)

        await upload_file.seek(0)
        model_bytes = await upload_file.read()

        if suffix == ".onnx":
            if ort is None:
                raise HTTPException(status_code=500, detail="onnxruntime is not installed on the backend.")

            session = ort.InferenceSession(model_bytes, providers=["CPUExecutionProvider"])
            input_shape = session.get_inputs()[0].shape
            feature_count = input_shape[-1] if input_shape and isinstance(input_shape[-1], int) else None
            feature_names = _fallback_feature_names(feature_count)
            normalized_names, aliases = _normalize_feature_bindings(feature_names)
            return LoadedModel(session, "onnx", normalized_names, aliases)

        if suffix == ".pmml":
            feature_names = _pmml_schema_from_bytes(model_bytes) or _fallback_feature_names()
            normalized_names, aliases = _normalize_feature_bindings(feature_names)
            return LoadedModel(object(), "pmml-heuristic", normalized_names, aliases)

        raise HTTPException(status_code=400, detail="Unsupported model type. Upload .pkl, .pmml, .onnx, or .joblib.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to load model in memory: {exc}") from exc
    finally:
        gc.collect()
