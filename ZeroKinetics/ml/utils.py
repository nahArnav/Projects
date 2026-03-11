"""ZeroKinetics ML — Utility Functions (Triplet Network)

Provides path management, logging, and validation helpers
for the Triplet Network gesture biometric system.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional



BASE_DIR = Path(__file__).parent
SAVED_MODELS_DIR = BASE_DIR / "saved_models"

def get_model_dir(student_id: str) -> Path:
    d = SAVED_MODELS_DIR / student_id
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_model_path(student_id: str) -> Path:
    return get_model_dir(student_id) / f"model_{student_id}.h5"

def get_scaler_path(student_id: str) -> Path:
    return get_model_dir(student_id) / f"scaler_{student_id}.pkl"

def get_threshold_path(student_id: str) -> Path:
    return get_model_dir(student_id) / f"threshold_{student_id}.json"

def model_exists(student_id: str) -> bool:
    return get_model_path(student_id).exists()



def save_threshold(student_id: str, threshold: float, metrics: Optional[dict] = None):
    data = {"threshold": threshold}
    if metrics:
        data["metrics"] = metrics
    with open(get_threshold_path(student_id), "w") as f:
        json.dump(data, f, indent=2)

def load_threshold(student_id: str) -> float:
    path = get_threshold_path(student_id)
    if not path.exists():
        return 0.5
    with open(path, "r") as f:
        data = json.load(f)
    return data.get("threshold", 0.5)



def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "[%(asctime)s] %(name)s %(levelname)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger



TIMESTEPS = 128             # Fixed sequence length (resampled)
RAW_FEATURES = 6            # acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z
NUM_FEATURES = 11           # 6 raw + acc_mag + gyro_mag + jerkX + jerkY + jerkZ
SAMPLING_RATE_HZ = 100
MIN_GESTURE_SAMPLES = 10    # Minimum gestures for registration
EMBEDDING_DIM = 128         # Encoder output dimension
AUTH_THRESHOLD = 0.35       # Euclidean distance threshold for authentication
TRIPLET_MARGIN = 0.5        # Margin for triplet loss (0.5 for L2-normalized embeddings)
CONTRASTIVE_MARGIN = 1.0    # Legacy — kept for backward compat



def get_embeddings_path(student_id: str) -> Path:
    return get_model_dir(student_id) / f"embeddings_{student_id}.npy"

def get_encoder_path(student_id: str = "shared") -> Path:
    return SAVED_MODELS_DIR / f"encoder_{student_id}.h5"

def get_siamese_path() -> Path:
    return SAVED_MODELS_DIR / "siamese_model.h5"

def get_triplet_path() -> Path:
    return SAVED_MODELS_DIR / "triplet_model.h5"

def get_triplet_encoder_path() -> Path:
    return SAVED_MODELS_DIR / "zerokinetics_encoder.h5"


SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
