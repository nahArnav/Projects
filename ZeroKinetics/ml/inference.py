"""
ZeroKinetics ML — Triplet Network Inference Pipeline

Authentication flow:
    1. Capture gesture → preprocess → (128, 11)
    2. Anti-spoof checks (variance, amplitude, duration, entropy)
    3. Encoder → 128-dim L2-normalized embedding
    4. Load stored mean embedding for claimed user
    5. Compute Euclidean distance
    6. distance < threshold → verified

Output format:
    {"verified": true, "distance": 0.28, "threshold": 0.35}
"""

import numpy as np
import tensorflow as tf
from typing import Dict, Optional
from threading import Lock

from data_processing import convert_sensor_readings_to_array, preprocess_gesture
from siamese_model import load_encoder
from embeddings_store import (
    load_user_embedding,
    euclidean_distance,
    has_embeddings,
)
from utils import (
    TIMESTEPS,
    NUM_FEATURES,
    EMBEDDING_DIM,
    AUTH_THRESHOLD,
    get_encoder_path,
    get_triplet_encoder_path,
    setup_logger,
)

logger = setup_logger("inference")




_encoder_cache: Optional[tf.keras.Model] = None
_cache_lock = Lock()


def _get_cached_encoder() -> tf.keras.Model:
    """Load and cache the shared encoder model (prefers triplet encoder)."""
    global _encoder_cache
    with _cache_lock:
        if _encoder_cache is None:

            triplet_path = get_triplet_encoder_path()
            legacy_path = get_encoder_path()

            if triplet_path.exists():
                _encoder_cache = load_encoder(str(triplet_path))
                logger.info("Triplet encoder cached for inference")
            elif legacy_path.exists():
                _encoder_cache = load_encoder(str(legacy_path))
                logger.info("Legacy encoder cached for inference")
            else:
                raise FileNotFoundError(
                    f"No trained encoder found. "
                    "Please train the Triplet model first."
                )
    return _encoder_cache


def clear_cache():
    """Clear the encoder cache."""
    global _encoder_cache
    with _cache_lock:
        _encoder_cache = None




def compute_signal_entropy(signal: np.ndarray, bins: int = 50) -> float:
    """Compute Shannon entropy to detect flat/replayed signals."""
    hist, _ = np.histogram(signal, bins=bins, density=True)
    hist = hist[hist > 0]
    return -np.sum(hist * np.log2(hist)) if len(hist) > 0 else 0.0


def check_motion_variance(data: np.ndarray, min_variance: float = 0.001) -> bool:
    """Reject flat/static signals."""
    variance = np.var(data, axis=0)
    return float(np.mean(variance)) >= min_variance


def check_motion_amplitude(data: np.ndarray, min_amplitude: float = 0.05) -> bool:
    """Reject signals with too little motion."""
    amplitude = np.max(data, axis=0) - np.min(data, axis=0)
    return float(np.mean(amplitude[:3])) >= min_amplitude


def check_duration(data: np.ndarray, min_t: int = 30, max_t: int = 500) -> bool:
    """Check gesture duration is within range."""
    return min_t <= data.shape[0] <= max_t


def check_entropy(data: np.ndarray, min_entropy: float = 1.0) -> bool:
    """Reject low entropy signals (possible replay)."""
    entropies = []
    for ch in range(min(data.shape[1], 6)):
        ent = compute_signal_entropy(data[:, ch])
        entropies.append(ent)
    return float(np.mean(entropies)) >= min_entropy


def check_statistical_anomaly(data: np.ndarray) -> bool:
    """Reject impossible sensor readings."""
    if np.any(np.isnan(data)) or np.any(np.isinf(data)):
        return False
    if np.max(np.abs(data[:, :3])) > 200:
        return False
    if np.max(np.abs(data[:, 3:6])) > 100:
        return False
    for i in range(data.shape[1]):
        if np.std(data[:, i]) < 1e-6 and data.shape[0] > 20:
            return False
    return True


def run_anti_spoof_checks(data: np.ndarray) -> Dict:
    """Run all anti-spoof checks on raw 6-channel sensor data."""
    results = {"passed": True, "checks": {}, "reasons": []}

    checks = [
        ("motion_variance", check_motion_variance,
         "Insufficient motion — possible static/spoofed signal"),
        ("motion_amplitude", check_motion_amplitude,
         "Motion amplitude too small"),
        ("duration", check_duration,
         f"Gesture duration out of range ({data.shape[0]} timesteps)"),
        ("entropy", check_entropy,
         "Low signal entropy — possible replay attack"),
        ("statistical", check_statistical_anomaly,
         "Statistical anomaly in sensor data"),
    ]

    for name, check_fn, reason in checks:
        passed = check_fn(data)
        results["checks"][name] = passed
        if not passed:
            results["passed"] = False
            results["reasons"].append(reason)

    return results




def predict_gesture(student_id: str, gesture_data: list) -> Dict:
    """
    Full Siamese inference pipeline.

    Returns:
        {verified, distance, threshold, confidence, anti_spoof}
    """

    if not has_embeddings(student_id):
        return {
            "verified": False,
            "distance": 999.0,
            "threshold": AUTH_THRESHOLD,
            "confidence": 0.0,
            "error": f"No embeddings found for student {student_id}. "
                     f"Please complete gesture enrollment first.",
        }

    raw_data = convert_sensor_readings_to_array(gesture_data)
    if raw_data.shape[0] < 10 or raw_data.shape[1] != 6:
        return {
            "verified": False,
            "distance": 999.0,
            "threshold": AUTH_THRESHOLD,
            "confidence": 0.0,
            "error": f"Invalid gesture data shape: {raw_data.shape}",
        }

    gesture_processed = preprocess_gesture(raw_data)

    encoder = _get_cached_encoder()
    gesture_batch = gesture_processed.reshape(1, TIMESTEPS, NUM_FEATURES)
    embedding = encoder.predict(gesture_batch, verbose=0)[0]

    embedding_norm = float(np.linalg.norm(embedding))

    stored_embedding = load_user_embedding(student_id)
    if stored_embedding is None:
        return {
            "verified": False,
            "distance": 999.0,
            "threshold": AUTH_THRESHOLD,
            "confidence": 0.0,
            "error": f"Failed to load embedding for {student_id}",
        }

    stored_norm = float(np.linalg.norm(stored_embedding))
    distance = euclidean_distance(embedding, stored_embedding)

    verified = distance < AUTH_THRESHOLD

    confidence = abs(AUTH_THRESHOLD - distance) / AUTH_THRESHOLD
    confidence = min(confidence, 1.0)

    logger.info(
        f"Inference {student_id}: distance={distance:.4f}, "
        f"threshold={AUTH_THRESHOLD}, verified={verified}, "
        f"embedding_norm={embedding_norm:.4f}, "
        f"centroid_norm={stored_norm:.4f}"
    )

    return {
        "verified": verified,
        "distance": round(distance, 4),
        "threshold": AUTH_THRESHOLD,
        "confidence": round(confidence, 4),
    }
