"""
ML Classifier for Truth Bureau
Primary:  HuggingFace text-classification pipeline (DistilBERT).
Fallback: Heuristic keyword-based scoring when the model is unavailable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Lazy-loaded globals ─────────────────────────────────────────────────────
_pipeline = None
_model_ready = False


@dataclass
class ClassificationResult:
    label: str          # "FAKE" or "REAL"
    confidence: float   # 0.0 – 1.0


# ── Heuristic fallback ─────────────────────────────────────────────────────
_FAKE_SIGNALS = [
    "you won't believe", "shocking", "exposed", "secret",
    "they don't want you to know", "mind-blowing", "conspiracy",
    "cover-up", "banned", "censored", "wake up", "big pharma",
    "doctors hate", "one weird trick", "must watch",
    "share before it's too late", "mainstream media won't tell you",
    "spread this before it's deleted", "bombshell", "unbelievable",
]

_REAL_SIGNALS = [
    "according to", "officials said", "the report states",
    "data shows", "peer-reviewed", "study published",
    "reuters", "associated press", "confirmed by",
    "government statement", "press release", "research findings",
    "published in the journal", "the investigation found",
]


def _heuristic_classify(text: str) -> ClassificationResult:
    """Simple keyword-based scoring used when the transformer is unavailable."""
    lower = text.lower()
    fake_hits = sum(1 for p in _FAKE_SIGNALS if p in lower)
    real_hits = sum(1 for p in _REAL_SIGNALS if p in lower)

    total = fake_hits + real_hits
    if total == 0:
        return ClassificationResult(label="UNCERTAIN", confidence=0.50)

    fake_ratio = fake_hits / total
    if fake_ratio > 0.6:
        return ClassificationResult(label="FAKE", confidence=round(0.5 + fake_ratio * 0.4, 2))
    if fake_ratio < 0.4:
        return ClassificationResult(label="REAL", confidence=round(0.5 + (1 - fake_ratio) * 0.4, 2))
    return ClassificationResult(label="UNCERTAIN", confidence=0.55)


# ── Model loading ──────────────────────────────────────────────────────────
_LOCAL_MODEL_DIR = Path(__file__).resolve().parent / "trained_model"


def load_model() -> None:
    """
    Load the text-classification pipeline.
    Prefers a locally fine-tuned model from ./trained_model if it exists,
    otherwise falls back to the HuggingFace remote model.
    Call once at startup; subsequent calls are no-ops.
    """
    global _pipeline, _model_ready
    if _model_ready:
        return
    try:
        from transformers import pipeline as hf_pipeline
        import torch

        # ⚡ Universal Hardware Detection (Windows / Mac / Linux)
        if torch.cuda.is_available():
            active_device = torch.device("cuda")
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"Hardware detection: NVIDIA GPU ({gpu_name}) found. Routing to CUDA.")
        elif torch.backends.mps.is_available():
            active_device = torch.device("mps")
            logger.info("Hardware detection: Apple Silicon found. Routing to MPS.")
        else:
            active_device = torch.device("cpu")
            logger.info("Hardware detection: No GPU found. Defaulting to CPU.")

        if _LOCAL_MODEL_DIR.exists() and (_LOCAL_MODEL_DIR / "config.json").exists():
            model_path = str(_LOCAL_MODEL_DIR)
            logger.info("Loading locally trained model from %s …", model_path)
        else:
            model_path = "hamzab/roberta-fake-news-classification"
            logger.info("Loading HuggingFace remote model: %s …", model_path)

        # ⚡ Pass the dynamically selected device to the pipeline
        _pipeline = hf_pipeline(
            "text-classification",
            model=model_path,
            truncation=True,
            max_length=512,
            device=active_device  
        )
        _model_ready = True
        logger.info("Model loaded successfully.")
    except Exception as exc:
        logger.warning("Could not load model (%s). Using heuristic fallback.", exc)
        _model_ready = False


def classify(text: str) -> ClassificationResult:
    """
    Classify *text* as REAL or FAKE.
    Falls back to heuristic scoring if the transformer model is unavailable.
    """
    if not _model_ready or _pipeline is None:
        return _heuristic_classify(text)

    try:
        # Truncate very long texts for speed
        truncated = text[:2048]
        result = _pipeline(truncated)[0]
        raw_label: str = result["label"].upper()
        score: float = result["score"]

        # Normalise labels coming from the model
        if "FAKE" in raw_label or raw_label in ("LABEL_0", "FAKE"):
            label = "FAKE"
        elif "REAL" in raw_label or raw_label in ("LABEL_1", "REAL"):
            label = "REAL"
        else:
            label = "UNCERTAIN"

        return ClassificationResult(label=label, confidence=round(score, 4))
    except Exception as exc:
        logger.error("Model inference failed: %s – falling back to heuristic.", exc)
        return _heuristic_classify(text)