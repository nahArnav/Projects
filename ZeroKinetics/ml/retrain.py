"""
ZeroKinetics ML — Multi-User Encoder Retrain

Uses all registered users' training data to retrain the encoder
from scratch with proper multi-user triplets.

This fixes embedding collapse caused by single-user training.

Usage:
    python3 retrain.py
"""

import numpy as np
from pathlib import Path
from tensorflow import keras

from siamese_model import build_triplet_model, load_encoder
from pair_generator import generate_triplets_from_samples
from embeddings_store import register_user
from evaluate import evaluate_triplet
from train import EmbeddingMonitor
from utils import (
    TIMESTEPS, NUM_FEATURES, EMBEDDING_DIM, TRIPLET_MARGIN,
    SAVED_MODELS_DIR, get_triplet_encoder_path, get_encoder_path,
    get_triplet_path, setup_logger,
)

logger = setup_logger("retrain")


def load_all_training_data():
    """Load all registered users' training data."""
    users = {}
    for user_dir in sorted(SAVED_MODELS_DIR.iterdir()):
        if not user_dir.is_dir():
            continue
        training_path = user_dir / "training_data.npy"
        if not training_path.exists():
            continue

        data = np.load(training_path, allow_pickle=True)
        valid = [s for s in data if s.shape == (TIMESTEPS, NUM_FEATURES)]
        if len(valid) >= 2:
            users[user_dir.name] = valid
            logger.info(f"Loaded {len(valid)} gestures for user {user_dir.name[:12]}...")

    return users


def retrain(
    epochs: int = 30,
    batch_size: int = 32,
    learning_rate: float = 0.0005,
    target_triplets: int = 50000,
):
    """Retrain the encoder using all registered users' data."""
    print("=" * 70)
    print("ZeroKinetics — Multi-User Encoder Retrain")
    print("=" * 70)

    student_gestures = load_all_training_data()
    n_users = len(student_gestures)
    total_gestures = sum(len(g) for g in student_gestures.values())

    print(f"\nFound {n_users} users with {total_gestures} total gestures")
    for uid, gestures in student_gestures.items():
        print(f"  {uid[:12]}.. -> {len(gestures)} gestures")

    if n_users < 2:
        print("\nError: Need at least 2 users with training data to retrain.")
        return

    print(f"\nGenerating {target_triplets} triplets...")
    anchors, positives, negatives = generate_triplets_from_samples(
        student_gestures, target_triplets=target_triplets,
    )
    print(f"   Generated {len(anchors)} triplets")

    n_val = max(int(len(anchors) * 0.2), 1)
    val_a, val_p, val_n = anchors[:n_val], positives[:n_val], negatives[:n_val]
    train_a, train_p, train_n = anchors[n_val:], positives[n_val:], negatives[n_val:]

    train_dummy = np.zeros((len(train_a), 3 * EMBEDDING_DIM))
    val_dummy = np.zeros((len(val_a), 3 * EMBEDDING_DIM))

    print(f"   Train: {len(train_a)} triplets, Val: {len(val_a)} triplets")

    print(f"\nBuilding Triplet model (margin={TRIPLET_MARGIN})...")
    triplet, encoder = build_triplet_model(learning_rate=learning_rate)

    triplet_path = str(get_triplet_path())
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=7, restore_best_weights=True, verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            triplet_path, monitor="val_loss", save_best_only=True, verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6, verbose=1,
        ),
        EmbeddingMonitor(encoder, val_a, val_p, val_n, log_every=2),
    ]

    print(f"\nTraining for {epochs} epochs (batch_size={batch_size}, lr={learning_rate})...")
    history = triplet.fit(
        [train_a, train_p, train_n], train_dummy,
        validation_data=([val_a, val_p, val_n], val_dummy),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    epochs_trained = len(history.history["loss"])
    final_loss = history.history["loss"][-1]
    final_val_loss = history.history["val_loss"][-1]
    print(f"\nTraining complete: {epochs_trained} epochs")
    print(f"   Final loss: {final_loss:.4f}, Val loss: {final_val_loss:.4f}")

    print("\nEvaluating on validation set...")
    metrics = evaluate_triplet(encoder, val_a, val_p, val_n)

    print(f"\n  Intra-user dist: {metrics['intra_user_mean']:.4f} ± {metrics['intra_user_std']:.4f}")
    print(f"  Inter-user dist: {metrics['inter_user_mean']:.4f} ± {metrics['inter_user_std']:.4f}")
    print(f"  Separation:      {metrics['separation']:.4f}")
    if "accuracy" in metrics:
        print(f"  Accuracy:        {metrics['accuracy']:.4f}")
    if "eer" in metrics:
        print(f"  EER:             {metrics['eer']:.4f}")

    encoder_path = str(get_triplet_encoder_path())
    encoder.save(encoder_path)
    encoder.save(str(get_encoder_path()))
    triplet.save(triplet_path)
    print(f"\nEncoder saved to {encoder_path}")

    print("\nRe-registering all users with the new encoder...")
    for uid, gestures in student_gestures.items():
        mean_emb = register_user(uid, gestures, encoder)
        print(f"  User {uid[:12]}.. -> centroid norm: {np.linalg.norm(mean_emb):.4f}")


    intra = metrics["intra_user_mean"]
    inter = metrics["inter_user_mean"]
    suggested = (intra + inter) / 2
    print(f"\nSuggested threshold: {suggested:.4f}")
    print(f"   (midpoint of intra={intra:.4f} and inter={inter:.4f})")

    print("\n" + "=" * 70)
    if metrics["separation"] > 0.25:
        print("SUCCESS: Good embedding separation.")
    elif metrics["separation"] > 0.1:
        print("WARNING: Partial separation achieved. Consider additional data.")
    else:
        print("FAILURE: Embedding collapse persists. Verify diverse training data.")
    print("=" * 70)


if __name__ == "__main__":
    retrain()
