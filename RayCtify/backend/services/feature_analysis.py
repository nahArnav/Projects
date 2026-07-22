from __future__ import annotations

from math import exp
from typing import Any

import numpy as np

from .feature_catalog import is_sensitive_feature, label_from_key, sanitize_key


POSITIVE_HINTS = {"income", "credit", "savings", "employment", "reserve", "buffer", "collateral", "cash"}
NEGATIVE_HINTS = {
    "debt",
    "loan",
    "ltv",
    "delinq",
    "late",
    "default",
    "utilization",
    "risk",
    "zip",
    "demographic",
    "marital",
}

DEFAULT_RANGES = {
    "annual_income": (20000, 250000, False),
    "credit_score": (300, 850, False),
    "debt_to_income": (0, 100, True),
    "loan_amount": (5000, 250000, True),
    "employment_years": (0, 30, False),
    "savings_buffer": (0, 24, False),
    "late_payments": (0, 12, True),
    "loan_to_value": (20, 120, True),
    "age": (18, 80, False),
}

CATEGORY_SIGNALS = {
    "collateral_quality": {"Prime": 0.8, "Stable": 0.2, "Thin": -0.8},
    "zip_code_cluster": {"Prime Growth": 0.6, "Transitional": -0.1, "Redlined Legacy": -0.85},
    "demographic_segment": {"Segment A": 0.4, "Segment B": -0.15, "Segment C": -0.7},
    "marital_status": {"Married": 0.25, "Single": -0.2, "Divorced": -0.3},
}


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _logistic(value: float) -> float:
    return 1 / (1 + exp(-value))


def infer_weight_sign(feature_name: str) -> float:
    normalized = sanitize_key(feature_name)
    if any(hint in normalized for hint in POSITIVE_HINTS):
        return 1.0
    if any(hint in normalized for hint in NEGATIVE_HINTS):
        return -1.0
    return -1.0 if is_sensitive_feature(normalized) else 0.6


def extract_model_weights(model: Any, feature_names: list[str]) -> dict[str, float]:
    is_rayctified = getattr(model, "is_rayctified", False)
    
    # Deep unwrap to find the actual Scikit-Learn model
    base_engine = model
    for _ in range(5):
        if hasattr(base_engine, "_engine"):
            base_engine = getattr(base_engine, "_engine")
        elif hasattr(base_engine, "base_estimator"):
            base_engine = getattr(base_engine, "base_estimator")
        elif hasattr(base_engine, "base_model"):
            base_engine = getattr(base_engine, "base_model")
        elif hasattr(base_engine, "steps"):
            base_engine = base_engine.steps[-1][1]
        else:
            break
            
    raw_weights: dict[str, float] = {}
    # Extract raw model math
    if hasattr(base_engine, "coef_"):
        coeffs = np.asarray(getattr(base_engine, "coef_")).reshape(-1)
        for i, name in enumerate(feature_names):
            raw_weights[name] = abs(float(coeffs[i])) if i < len(coeffs) else 0.01
    elif hasattr(base_engine, "feature_importances_"):
        imps = np.asarray(getattr(base_engine, "feature_importances_")).reshape(-1)
        for i, name in enumerate(feature_names):
            raw_weights[name] = float(imps[i]) if i < len(imps) else 0.01
    else:
        for name in feature_names:
            raw_weights[name] = 0.01

    # Apply sensitive feature masking
    refined_weights: dict[str, float] = {}
    for name in feature_names:
        if is_rayctified and is_sensitive_feature(name):
            refined_weights[name] = 0.0
        else:
            refined_weights[name] = raw_weights.get(name, 0.01)

    total = sum(refined_weights.values()) or 1.0
    return {name: (weight / total) for name, weight in refined_weights.items()}


def feature_signal(feature_name: str, raw_value: Any) -> float:
    normalized = sanitize_key(feature_name)

    if normalized in CATEGORY_SIGNALS:
        return CATEGORY_SIGNALS[normalized].get(str(raw_value), 0.0)

    if normalized in DEFAULT_RANGES:
        lower, upper, invert = DEFAULT_RANGES[normalized]
        scaled = (_safe_float(raw_value, lower) - lower) / (upper - lower)
        scaled = max(0.0, min(1.0, scaled))
        centered = (scaled - 0.5) * 2
        return -centered if invert else centered

    if isinstance(raw_value, str):
        return 0.5 if raw_value else 0.0

    numeric = _safe_float(raw_value, 50.0)
    centered = max(-1.0, min(1.0, (numeric - 50.0) / 50.0))
    if is_sensitive_feature(normalized):
        return -abs(centered or 0.6)
    return centered


def build_feature_breakdown(record: dict[str, Any], feature_names: list[str], score: float, model: Any = None) -> tuple[list[dict], list[str]]:
    from .feature_catalog import label_from_key, is_sensitive_feature
    from .feature_analysis import extract_model_weights, feature_signal
    
    weights = extract_model_weights(model, feature_names)
    contributions: list[dict[str, Any]] = []

    for feature_name in feature_names:
        signal = feature_signal(feature_name, record.get(feature_name))
        
        # Multiply blended absolute weights with the dynamic signal magnitude
        # This guarantees the percentages move fluidly when sliders are changed
        impact = weights.get(feature_name, 0.0) * signal
        
        if is_sensitive_feature(feature_name):
            impact *= 1.35

        contributions.append({
            "feature": feature_name,
            "label": label_from_key(feature_name),
            "value": record.get(feature_name),
            "impact": float(impact),
            "sensitive": is_sensitive_feature(feature_name),
        })

    # Normalize the absolute values of the impacts to sum up exactly to the total approval score
    abs_total = sum(abs(item["impact"]) for item in contributions)
    scaling = score / abs_total if abs_total > 1e-6 else 1.0

    for item in contributions:
        item["impact"] = round(item["impact"] * scaling, 4)
        
        if item["sensitive"]:
            item["rationale"] = f"{item['label']} acted as a sensitive or proxy variable and materially influenced the decision path."
        elif item["impact"] >= 0:
            item["rationale"] = f"{item['label']} supported the approval score on this run."
        else:
            item["rationale"] = f"{item['label']} reduced the approval score on this run."

    contributions.sort(key=lambda item: abs(item["impact"]), reverse=True)
    flagged_sensitive = [
        item["label"] for item in contributions if item["sensitive"] and abs(item["impact"]) >= 0.03
    ]
    return contributions, flagged_sensitive


def confidence_from_score(score: float) -> float:
    return round(min(0.99, max(0.52, 0.55 + abs(score - 0.5) * 0.9)), 4)


def score_from_raw_prediction(raw_prediction: Any) -> float:
    try:
        value = float(raw_prediction)
        if 0.0 <= value <= 1.0:
            return value
        return float(_logistic(value))
    except (TypeError, ValueError):
        return 0.8 if str(raw_prediction).lower() in {"1", "true", "approved", "accept", "accepted"} else 0.2


def summarize_user_result(decision: str, breakdown: list[dict], sensitive_flags: list[str]) -> str:
    # Ignore factors with < 1% impact for the summary string
    significant = [item for item in breakdown if abs(item["impact"]) > 0.01]
    top_labels = ", ".join(item["label"] for item in significant[:2]) or "standard financial factors"
    
    if sensitive_flags:
        return f"{decision.title()} with primary influence from {top_labels}."
    return f"{decision.title()} driven cleanly by {top_labels}. No demographic bias detected."


def sensitive_penalty_percent(result: dict[str, Any]) -> float:
    penalty = sum(
        abs(item["impact"])
        for item in result.get("feature_breakdown", [])
        if item.get("sensitive") and item.get("impact", 0) < 0
    )
    return round(penalty * 100, 1)

