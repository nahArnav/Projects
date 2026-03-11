"""
ZeroKinetics ML — Triplet Network Training Pipeline

Trains a Triplet Network using triplet loss on gesture triplets.

Config:
    epochs = 20
    batch_size = 32
    optimizer = Adam
    learning_rate = 0.001
    validation_split = 0.2
"""

import numpy as np
from tensorflow import keras
from typing import Dict, Optional
from pathlib import Path

from siamese_model import build_triplet_model
from pair_generator import (
    load_dataset,
    generate_training_triplets,
    generate_triplets_from_samples,
)
from embeddings_store import register_user
from data_processing import (
    preprocess_gesture,
    preprocess_batch,
    convert_sensor_readings_to_array,
)
from evaluate import evaluate_triplet
from utils import (
    TIMESTEPS,
    NUM_FEATURES,
    EMBEDDING_DIM,
    MIN_GESTURE_SAMPLES,
    SAVED_MODELS_DIR,
    get_encoder_path,
    get_triplet_path,
    get_triplet_encoder_path,
    get_model_dir,
    setup_logger,
)

logger = setup_logger("train")


class EmbeddingMonitor(keras.callbacks.Callback):
    """
    Monitor embedding distances during training to detect collapse.

    Logs intra/inter distances every N epochs and warns if the
    encoder is collapsing (all distances converging).
    """

    def __init__(self, encoder, val_anchors, val_positives, val_negatives, log_every=2):
        super().__init__()
        self.encoder = encoder
        self.val_a = val_anchors[:100]
        self.val_p = val_positives[:100]
        self.val_n = val_negatives[:100]
        self.log_every = log_every

    def on_epoch_end(self, epoch, logs=None):
        if (epoch + 1) % self.log_every != 0:
            return

        a_emb = self.encoder.predict(self.val_a, verbose=0)
        p_emb = self.encoder.predict(self.val_p, verbose=0)
        n_emb = self.encoder.predict(self.val_n, verbose=0)

        d_pos = np.sqrt(np.sum((a_emb - p_emb) ** 2, axis=1))
        d_neg = np.sqrt(np.sum((a_emb - n_emb) ** 2, axis=1))

        norms = np.linalg.norm(a_emb, axis=1)

        logger.info(
            f"[Epoch {epoch+1}] Embedding Monitor:\n"
            f"  d_pos: {d_pos.mean():.4f} ± {d_pos.std():.4f}\n"
            f"  d_neg: {d_neg.mean():.4f} ± {d_neg.std():.4f}\n"
            f"  separation: {d_neg.mean() - d_pos.mean():.4f}\n"
            f"  emb_norm: {norms.mean():.4f} ± {norms.std():.4f}"
        )

        if d_neg.mean() - d_pos.mean() < 0.05:
            logger.warning(
                f"Warning: Low embedding separation ({d_neg.mean() - d_pos.mean():.4f})."
            )


def prepare_raw_samples(gesture_samples: list) -> list:
    """Convert API gesture dicts to list of (timesteps, 6) arrays."""
    arrays = []
    for sample in gesture_samples:
        if isinstance(sample, dict):
            readings = sample.get("data", sample.get("gestureData", []))
        else:
            readings = sample.data if hasattr(sample, "data") else []

        arr = convert_sensor_readings_to_array(readings)
        if arr.shape[0] > 10 and arr.shape[1] == 6:
            arrays.append(arr)
        else:
            logger.warning(f"Skipping sample with shape {arr.shape}")
    return arrays


def train_triplet_from_dataset(
    dataset_dir: str,
    epochs: int = 20,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    target_triplets: int = 50000,
) -> Dict:
    """Train the Triplet Network from a dataset directory."""
    logger.info(f"Starting Triplet training from {dataset_dir}")

    splits = generate_training_triplets(dataset_dir, target_triplets=target_triplets)

    train_a, train_p, train_n = splits["train"]
    val_a, val_p, val_n = splits["val"]

    logger.info(f"Triplets — train: {len(train_a)}, val: {len(val_a)}")


    train_dummy = np.zeros((len(train_a), 3 * EMBEDDING_DIM))
    val_dummy = np.zeros((len(val_a), 3 * EMBEDDING_DIM))

    triplet, encoder = build_triplet_model(learning_rate=learning_rate)

    triplet_path = str(get_triplet_path())
    encoder_path = str(get_triplet_encoder_path())

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=5, restore_best_weights=True, verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            triplet_path, monitor="val_loss", save_best_only=True, verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6, verbose=1,
        ),
        EmbeddingMonitor(encoder, val_a, val_p, val_n, log_every=2),
    ]

    history = triplet.fit(
        [train_a, train_p, train_n], train_dummy,
        validation_data=([val_a, val_p, val_n], val_dummy),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    encoder.save(encoder_path)
    triplet.save(triplet_path)

    encoder.save(str(get_encoder_path()))
    logger.info(f"Encoder saved → {encoder_path}")

    metrics = evaluate_triplet(encoder, val_a, val_p, val_n)

    student_gestures = load_dataset(dataset_dir)
    for student_id, gestures in student_gestures.items():
        register_user(student_id, gestures, encoder)

    logger.info(
        f"Training complete — "
        f"Intra-user dist: {metrics['intra_user_mean']:.4f}, "
        f"Inter-user dist: {metrics['inter_user_mean']:.4f}"
    )

    return {
        "status": "completed",
        "epochs_trained": len(history.history["loss"]),
        "metrics": metrics,
        "triplets": {
            "train": len(train_a),
            "val": len(val_a),
        },
    }


def train_student_model(
    student_id: str,
    gesture_samples: list,
    impostor_samples: Optional[list] = None,
    epochs: int = 20,
    batch_size: int = 32,
) -> Dict:
    """
    Register a student using a pre-trained (or new) Triplet encoder.

    If a trained encoder exists, generates the student's mean embedding.
    If not, trains one from available data first.
    """
    logger.info(f"Starting registration for student {student_id}")

    raw_arrays = prepare_raw_samples(gesture_samples)
    if len(raw_arrays) < MIN_GESTURE_SAMPLES:
        raise ValueError(f"Need {MIN_GESTURE_SAMPLES}+ samples, got {len(raw_arrays)}")
    logger.info(f"Valid gesture samples: {len(raw_arrays)}")

    processed = preprocess_batch(raw_arrays)

    triplet_encoder_path = get_triplet_encoder_path()
    encoder_path = get_encoder_path()

    if triplet_encoder_path.exists():
        from siamese_model import load_encoder
        encoder = load_encoder(str(triplet_encoder_path))
        logger.info("Using existing triplet encoder")
    elif encoder_path.exists():
        from siamese_model import load_encoder
        encoder = load_encoder(str(encoder_path))
        logger.info("Using existing pre-trained encoder")
    else:
        logger.info("No pre-trained encoder found, training from enrollment data")
        triplet, encoder = _train_from_enrollment(
            student_id, processed, impostor_samples, epochs, batch_size,
        )

    mean_embedding = register_user(student_id, list(processed), encoder)

    np.save(get_model_dir(student_id) / "training_data.npy", processed)

    logger.info(
        f"Registration complete for {student_id}: "
        f"{len(raw_arrays)} gestures → mean embedding"
    )

    return {
        "modelId": f"siamese_{student_id}",
        "status": "completed",
        "threshold": 0.35,
        "metrics": {
            "embeddings_count": len(raw_arrays),
            "embedding_dim": EMBEDDING_DIM,
        },
        "samples_used": {
            "genuine": len(raw_arrays),
            "processed": len(processed),
        },
    }


def _generate_diverse_impostors(
    processed_gestures: np.ndarray,
    n_impostors: int = 100,
) -> list:
    """Generate diverse synthetic impostor gestures for enrollment training."""
    impostors = []
    n_per_method = max(n_impostors // 5, 1)

    for _ in range(n_per_method):
        noise = np.random.randn(TIMESTEPS, NUM_FEATURES).astype(np.float32)
        mean = np.mean(noise, axis=0, keepdims=True)
        std = np.std(noise, axis=0, keepdims=True) + 1e-8
        noise = (noise - mean) / std
        impostors.append(noise)

    for g in processed_gestures[:n_per_method]:
        impostors.append(g[::-1].copy())

    for g in processed_gestures[:n_per_method]:
        shuffled = g.copy()
        shuffled = shuffled[:, np.random.permutation(NUM_FEATURES)]
        impostors.append(shuffled)

    for g in processed_gestures[:n_per_method]:
        impostors.append(-g.copy())

    for _ in range(n_per_method):
        t = np.linspace(0, 2 * np.pi, TIMESTEPS)
        sig = np.zeros((TIMESTEPS, NUM_FEATURES), dtype=np.float32)
        for ch in range(NUM_FEATURES):
            freq = np.random.uniform(0.5, 10.0)
            phase = np.random.uniform(0, 2 * np.pi)
            amplitude = np.random.uniform(0.5, 2.0)
            sig[:, ch] = amplitude * np.sin(freq * t + phase)
        mean = np.mean(sig, axis=0, keepdims=True)
        std = np.std(sig, axis=0, keepdims=True) + 1e-8
        sig = (sig - mean) / std
        impostors.append(sig)

    logger.info(f"Generated {len(impostors)} diverse impostor gestures")
    return impostors


def _train_from_enrollment(
    student_id: str,
    processed_gestures: np.ndarray,
    impostor_samples: Optional[list],
    epochs: int,
    batch_size: int,
):
    """Train a Triplet encoder from enrollment data only."""
    from pair_generator import generate_triplets_from_samples

    student_gestures = {student_id: list(processed_gestures)}

    if impostor_samples:
        impostor_arrays = prepare_raw_samples(impostor_samples)
        impostor_processed = preprocess_batch(impostor_arrays)
        student_gestures["impostor"] = list(impostor_processed)

    for student_dir in SAVED_MODELS_DIR.iterdir():
        if not student_dir.is_dir() or student_dir.name == student_id:
            continue
        raw_data_path = student_dir / "training_data.npy"
        if raw_data_path.exists():
            data = np.load(raw_data_path, allow_pickle=True)
            valid = [s for s in data if s.shape == (TIMESTEPS, NUM_FEATURES)]
            if len(valid) >= 2:
                student_gestures[student_dir.name] = valid
                logger.info(
                    f"Loaded {len(valid)} gestures from existing user {student_dir.name[:8]}..."
                )

    if len(student_gestures) < 2:
        logger.warning("Only one user available, generating synthetic impostors")
        diverse_impostors = _generate_diverse_impostors(
            processed_gestures, n_impostors=100
        )
        student_gestures["synthetic_impostor"] = diverse_impostors

    logger.info(
        f"Training data: {len(student_gestures)} users, "
        + ", ".join(
            f"{uid[:8]}..={len(g)}"
            for uid, g in student_gestures.items()
        )
    )

    anchors, positives, negatives = generate_triplets_from_samples(student_gestures)

    n_val = max(int(len(anchors) * 0.2), 1)
    val_a, val_p, val_n = anchors[:n_val], positives[:n_val], negatives[:n_val]
    train_a, train_p, train_n = anchors[n_val:], positives[n_val:], negatives[n_val:]

    train_dummy = np.zeros((len(train_a), 3 * EMBEDDING_DIM))
    val_dummy = np.zeros((len(val_a), 3 * EMBEDDING_DIM))

    triplet, encoder = build_triplet_model()

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=5, restore_best_weights=True, verbose=1,
        ),
        EmbeddingMonitor(encoder, val_a, val_p, val_n, log_every=2),
    ]

    triplet.fit(
        [train_a, train_p, train_n], train_dummy,
        validation_data=([val_a, val_p, val_n], val_dummy),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    logger.info("Post-training embedding analysis:")
    a_emb = encoder.predict(val_a[:50], verbose=0)
    p_emb = encoder.predict(val_p[:50], verbose=0)
    n_emb = encoder.predict(val_n[:50], verbose=0)

    d_pos = np.sqrt(np.sum((a_emb - p_emb) ** 2, axis=1))
    d_neg = np.sqrt(np.sum((a_emb - n_emb) ** 2, axis=1))
    norms = np.linalg.norm(a_emb, axis=1)

    logger.info(
        f"  d_pos: {d_pos.mean():.4f} ± {d_pos.std():.4f}\n"
        f"  d_neg: {d_neg.mean():.4f} ± {d_neg.std():.4f}\n"
        f"  separation: {d_neg.mean() - d_pos.mean():.4f}\n"
        f"  emb_norm: {norms.mean():.4f} ± {norms.std():.4f}"
    )

    encoder.save(str(get_triplet_encoder_path()))
    encoder.save(str(get_encoder_path()))
    triplet.save(str(get_triplet_path()))

    return triplet, encoder
