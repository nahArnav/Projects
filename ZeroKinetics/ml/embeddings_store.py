"""
ZeroKinetics ML — Embedding Store for Siamese Authentication

During registration:
    - Student performs 10–15 gestures
    - Each gesture is passed through the encoder
    - Compute the MEAN embedding (average of all gesture embeddings)
    - Store only the mean embedding

During authentication:
    - New gesture → encoder → embedding
    - Compute Euclidean distance with stored mean embedding
    - distance < threshold → verified

Storage:
    user_embedding = {student_id: mean_embedding (128,)}
"""

import numpy as np
from pathlib import Path
from typing import Dict, Optional
from threading import Lock

from utils import (
    EMBEDDING_DIM,
    get_embeddings_path,
    setup_logger,
)

logger = setup_logger("embeddings_store")

_embeddings_cache: Dict[str, np.ndarray] = {}
_cache_lock = Lock()


def save_user_embedding(student_id: str, embedding: np.ndarray) -> Path:
    """
    Save the mean embedding for a user.

    Args:
        student_id: User identifier.
        embedding: Mean embedding of shape (EMBEDDING_DIM,).
    """
    assert embedding.ndim == 1 and embedding.shape[0] == EMBEDDING_DIM, (
        f"Expected shape ({EMBEDDING_DIM},), got {embedding.shape}"
    )

    path = get_embeddings_path(student_id)
    np.save(path, embedding)

    with _cache_lock:
        _embeddings_cache[student_id] = embedding

    logger.info(f"Saved mean embedding for {student_id} → {path}")
    return path


def load_user_embedding(student_id: str) -> Optional[np.ndarray]:
    """
    Load the mean embedding for a user.

    Returns:
        Embedding of shape (EMBEDDING_DIM,) or None if not found.
    """
    with _cache_lock:
        if student_id in _embeddings_cache:
            return _embeddings_cache[student_id]

    path = get_embeddings_path(student_id)
    if not path.exists():
        logger.warning(f"No embedding found for {student_id}")
        return None

    embedding = np.load(path)

    with _cache_lock:
        _embeddings_cache[student_id] = embedding

    logger.info(f"Loaded embedding for {student_id}")
    return embedding


def register_user(
    student_id: str,
    gestures: list,
    encoder,
) -> np.ndarray:
    """
    Register a user by computing and storing the mean embedding.

    Args:
        student_id: User identifier.
        gestures: List of preprocessed gesture arrays, each (100, 9).
        encoder: Trained Keras encoder model.

    Returns:
        Mean embedding of shape (128,).
    """
    gesture_batch = np.array(gestures)
    embeddings = encoder.predict(gesture_batch, verbose=0)

    norms = np.linalg.norm(embeddings, axis=1)
    logger.info(
        f"Embedding norms — min: {norms.min():.4f}, max: {norms.max():.4f}, "
        f"mean: {norms.mean():.4f}"
    )

    mean_embedding = np.mean(embeddings, axis=0)

    centroid_norm = np.linalg.norm(mean_embedding)
    if centroid_norm > 1e-8:
        mean_embedding = mean_embedding / centroid_norm
    logger.info(
        f"Centroid norm before normalization: {centroid_norm:.4f}, "
        f"after: {np.linalg.norm(mean_embedding):.4f}"
    )

    save_user_embedding(student_id, mean_embedding)

    logger.info(
        f"Registered {student_id}: {len(gestures)} gestures → "
        f"mean embedding ({mean_embedding.shape[0],})"
    )
    return mean_embedding


def euclidean_distance(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
    """
    Compute Euclidean distance between two embeddings.

    Returns:
        Distance (lower = more similar).
    """
    return float(np.sqrt(np.sum((embedding_a - embedding_b) ** 2)))


def has_embeddings(student_id: str) -> bool:
    """Check if a user has a stored embedding."""
    with _cache_lock:
        if student_id in _embeddings_cache:
            return True
    return get_embeddings_path(student_id).exists()


def clear_cache(student_id: Optional[str] = None):
    """Clear embedding cache."""
    with _cache_lock:
        if student_id:
            _embeddings_cache.pop(student_id, None)
        else:
            _embeddings_cache.clear()


def delete_user_embedding(student_id: str):
    """Delete stored embedding for a user."""
    path = get_embeddings_path(student_id)
    if path.exists():
        path.unlink()

    with _cache_lock:
        _embeddings_cache.pop(student_id, None)

    logger.info(f"Deleted embedding for {student_id}")
