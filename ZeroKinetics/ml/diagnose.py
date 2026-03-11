"""
ZeroKinetics ML — Embedding Diagnostics

Cross-user distance analysis to debug embedding collapse.

Compares embeddings between all registered users to verify:
  - Same-user distances are LOW (~0.10–0.25)
  - Different-user distances are HIGH (~0.50–1.0)
  - Separation is sufficient for reliable authentication

Usage:
    python3 diagnose.py
"""

import numpy as np
import sys
from pathlib import Path
from itertools import combinations

from siamese_model import load_encoder
from embeddings_store import load_user_embedding, euclidean_distance
from utils import (
    TIMESTEPS, NUM_FEATURES, EMBEDDING_DIM, AUTH_THRESHOLD,
    SAVED_MODELS_DIR, get_triplet_encoder_path, get_encoder_path,
    setup_logger,
)

logger = setup_logger("diagnose")


def load_all_users():
    """Load all registered users and their training data."""
    users = {}
    for user_dir in sorted(SAVED_MODELS_DIR.iterdir()):
        if not user_dir.is_dir():
            continue
        training_path = user_dir / "training_data.npy"
        embedding_path = user_dir / f"embeddings_{user_dir.name}.npy"

        if training_path.exists():
            data = np.load(training_path, allow_pickle=True)
            valid = [s for s in data if s.shape == (TIMESTEPS, NUM_FEATURES)]
            centroid = None
            if embedding_path.exists():
                centroid = np.load(embedding_path)
            if len(valid) >= 2:
                users[user_dir.name] = {
                    "gestures": valid,
                    "centroid": centroid,
                }
    return users


def diagnose():
    """Run full embedding diagnostics."""
    print("=" * 70)
    print("ZeroKinetics — Embedding Diagnostics")
    print("=" * 70)

    triplet_path = get_triplet_encoder_path()
    legacy_path = get_encoder_path()

    if triplet_path.exists():
        encoder = load_encoder(str(triplet_path))
        print(f"Encoder loaded: {triplet_path.name}")
    elif legacy_path.exists():
        encoder = load_encoder(str(legacy_path))
        print(f"Encoder loaded: {legacy_path.name}")
    else:
        print("Error: No encoder found. Train the model first.")
        return

    users = load_all_users()
    if len(users) < 2:
        print(f"Error: Need at least 2 registered users, found {len(users)}")
        return

    print(f"\nFound {len(users)} registered users:")
    for uid, info in users.items():
        print(f"  {uid[:12]}.. → {len(info['gestures'])} gestures")

    print("\n" + "=" * 70)
    print("1. EMBEDDING NORMS (should be ~1.0 for L2-normalized)")
    print("=" * 70)

    user_embeddings = {}
    for uid, info in users.items():
        batch = np.array(info["gestures"])
        embeddings = encoder.predict(batch, verbose=0)
        user_embeddings[uid] = embeddings

        norms = np.linalg.norm(embeddings, axis=1)
        print(
            f"  {uid[:12]}..: "
            f"norm={norms.mean():.4f} ± {norms.std():.4f} "
            f"(min={norms.min():.4f}, max={norms.max():.4f})"
        )

    print("\n" + "=" * 70)
    print("2. INTRA-USER DISTANCES (same user)")
    print("=" * 70)

    all_intra = []
    for uid, embeddings in user_embeddings.items():
        distances = []
        for i, j in combinations(range(len(embeddings)), 2):
            d = float(np.sqrt(np.sum((embeddings[i] - embeddings[j]) ** 2)))
            distances.append(d)
        all_intra.extend(distances)
        print(
            f"  {uid[:12]}..: "
            f"mean={np.mean(distances):.4f} ± {np.std(distances):.4f} "
            f"(min={np.min(distances):.4f}, max={np.max(distances):.4f})"
        )

    print("\n" + "=" * 70)
    print("3. INTER-USER DISTANCES (different users)")
    print("=" * 70)

    all_inter = []
    user_ids = list(user_embeddings.keys())
    for uid_a, uid_b in combinations(user_ids, 2):
        distances = []
        emb_a = user_embeddings[uid_a]
        emb_b = user_embeddings[uid_b]
        for i in range(min(len(emb_a), 20)):
            for j in range(min(len(emb_b), 20)):
                d = float(np.sqrt(np.sum((emb_a[i] - emb_b[j]) ** 2)))
                distances.append(d)
        all_inter.extend(distances)
        print(
            f"  {uid_a[:8]}.. vs {uid_b[:8]}..: "
            f"mean={np.mean(distances):.4f} ± {np.std(distances):.4f} "
            f"(min={np.min(distances):.4f}, max={np.max(distances):.4f})"
        )

    print("\n" + "=" * 70)
    print("4. CROSS-USER CENTROID TEST")
    print("=" * 70)

    for uid_a in user_ids:
        centroid_a = np.mean(user_embeddings[uid_a], axis=0)
        centroid_a = centroid_a / (np.linalg.norm(centroid_a) + 1e-8)

        for uid_b in user_ids:
            idx = np.random.randint(len(user_embeddings[uid_b]))
            gesture_emb = user_embeddings[uid_b][idx]
            d = float(np.sqrt(np.sum((gesture_emb - centroid_a) ** 2)))
            label = "SAME" if uid_a == uid_b else "DIFF"
            status = "PASS" if (label == "SAME" and d < AUTH_THRESHOLD) or \
                            (label == "DIFF" and d >= AUTH_THRESHOLD) else "FAIL"
            print(
                f"  [{status}] {uid_b[:8]}.. gesture vs {uid_a[:8]}.. centroid: "
                f"d={d:.4f} [{label}] "
                f"(threshold={AUTH_THRESHOLD})"
            )

    print("\n" + "=" * 70)
    print("5. SUMMARY")
    print("=" * 70)

    mean_intra = np.mean(all_intra) if all_intra else 0
    mean_inter = np.mean(all_inter) if all_inter else 0
    separation = mean_inter - mean_intra

    print(f"  Mean intra-user distance:  {mean_intra:.4f}")
    print(f"  Mean inter-user distance:  {mean_inter:.4f}")
    print(f"  Separation (inter - intra): {separation:.4f}")
    print(f"  Current threshold:          {AUTH_THRESHOLD}")

    if separation < 0.1:
        print("\n  COLLAPSE DETECTED: Separation is too small.")
        print("     Run retrain.py to retrain.")
    elif separation < 0.25:
        print("\n  WEAK SEPARATION: Consider retraining with more data.")
    else:
        print("\n  GOOD SEPARATION: Embeddings are well-separated.")
        print(f"     Suggested threshold: {(mean_intra + mean_inter) / 2:.4f}")

    if all_intra and all_inter:
        intra_max = np.percentile(all_intra, 95)
        inter_min = np.percentile(all_inter, 5)
        suggested = (intra_max + inter_min) / 2
        print(f"\n  Calibrated threshold suggestion: {suggested:.4f}")
        print(f"     (95th percentile intra: {intra_max:.4f}, "
              f"5th percentile inter: {inter_min:.4f})")


if __name__ == "__main__":
    diagnose()
