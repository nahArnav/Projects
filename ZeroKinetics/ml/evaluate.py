"""
ZeroKinetics ML — Evaluation Module (Triplet Network)

Computes biometric metrics using Euclidean distance:
    - Intra-user distance (anchor vs positive) — should be LOW
    - Inter-user distance (anchor vs negative) — should be HIGH
    - FAR, FRR, EER, Accuracy
    - t-SNE / PCA embedding visualization

Decision rule:
    distance < threshold → verified (positive)
    distance ≥ threshold → rejected (negative)
"""

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix,
)
from typing import Dict, Tuple, Optional

from utils import AUTH_THRESHOLD, SAVED_MODELS_DIR, setup_logger

logger = setup_logger("evaluate")


def compute_metrics_from_distances(
    y_true: np.ndarray,
    distances: np.ndarray,
    threshold: float,
) -> Dict:
    """
    Compute metrics using distance threshold.

    distance < threshold → positive (same user, label=1)
    distance >= threshold → negative (different user, label=0)
    """
    y_pred = (distances < threshold).astype(int)

    if len(set(y_true)) < 2:
        return {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": 0.0, "recall": 0.0, "f1_score": 0.0,
            "auc": 0.0, "far": 0.0, "frr": 0.0,
            "threshold": float(threshold),
        }

    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    frr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_true, -distances)),
        "far": float(far),
        "frr": float(frr),
        "true_positives": int(tp),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "threshold": float(threshold),
    }


def compute_eer_from_distances(
    y_true: np.ndarray,
    distances: np.ndarray,
) -> Tuple[float, float]:
    """Compute Equal Error Rate (EER) from distances."""
    scores = -distances
    fpr, tpr, thresholds = roc_curve(y_true, scores)
    fnr = 1.0 - tpr

    eer_idx = np.nanargmin(np.abs(fpr - fnr))
    eer = float((fpr[eer_idx] + fnr[eer_idx]) / 2)
    eer_threshold = float(-thresholds[eer_idx]) if eer_idx < len(thresholds) else 0.35

    return eer, eer_threshold


def find_optimal_threshold(
    y_true: np.ndarray,
    distances: np.ndarray,
    max_far: float = 0.05,
) -> Tuple[float, Dict]:
    """Find optimal distance threshold for authentication."""
    if len(set(y_true)) < 2:
        return AUTH_THRESHOLD, compute_metrics_from_distances(y_true, distances, AUTH_THRESHOLD)

    scores = -distances
    fpr, tpr, thresholds = roc_curve(y_true, scores)

    best_threshold = None
    best_tpr = -1

    for i, t in enumerate(thresholds):
        dist_thresh = -t
        if fpr[i] <= max_far and tpr[i] > best_tpr:
            best_tpr = tpr[i]
            best_threshold = dist_thresh

    if best_threshold is None:
        _, best_threshold = compute_eer_from_distances(y_true, distances)
        logger.warning(f"No threshold meets FAR<{max_far}, using EER: {best_threshold:.4f}")

    best_threshold = max(0.1, min(2.0, best_threshold))

    eer, _ = compute_eer_from_distances(y_true, distances)
    metrics = compute_metrics_from_distances(y_true, distances, best_threshold)
    metrics["eer"] = eer

    logger.info(f"Optimal threshold: {best_threshold:.4f} (EER: {eer:.4f})")
    return best_threshold, metrics




def evaluate_triplet(
    encoder,
    anchors: np.ndarray,
    positives: np.ndarray,
    negatives: np.ndarray,
) -> Dict:
    """
    Full evaluation of the Triplet model on validation triplets.

    Computes:
        - Intra-user distances (anchor ↔ positive) — should be LOW
        - Inter-user distances (anchor ↔ negative) — should be HIGH
        - FAR, FRR, accuracy at AUTH_THRESHOLD
        - EER and optimal threshold
    """
    anchor_emb = encoder.predict(anchors, verbose=0)
    positive_emb = encoder.predict(positives, verbose=0)
    negative_emb = encoder.predict(negatives, verbose=0)

    intra_distances = np.sqrt(np.sum((anchor_emb - positive_emb) ** 2, axis=1))
    inter_distances = np.sqrt(np.sum((anchor_emb - negative_emb) ** 2, axis=1))

    all_distances = np.concatenate([intra_distances, inter_distances])
    all_labels = np.concatenate([
        np.ones(len(intra_distances)),
        np.zeros(len(inter_distances)),
    ])

    threshold, metrics = find_optimal_threshold(all_labels, all_distances)

    metrics["intra_user_mean"] = float(np.mean(intra_distances))
    metrics["intra_user_std"] = float(np.std(intra_distances))
    metrics["inter_user_mean"] = float(np.mean(inter_distances))
    metrics["inter_user_std"] = float(np.std(inter_distances))
    metrics["separation"] = float(np.mean(inter_distances) - np.mean(intra_distances))

    logger.info(
        f"Triplet Evaluation:\n"
        f"  Intra-user dist: {metrics['intra_user_mean']:.4f} ± {metrics['intra_user_std']:.4f}\n"
        f"  Inter-user dist: {metrics['inter_user_mean']:.4f} ± {metrics['inter_user_std']:.4f}\n"
        f"  Separation:      {metrics['separation']:.4f}\n"
        f"  Accuracy:        {metrics['accuracy']:.4f}\n"
        f"  FAR: {metrics['far']:.4f}, FRR: {metrics['frr']:.4f}"
    )

    return metrics


def visualize_embeddings(
    encoder,
    student_gestures: Dict,
    method: str = "tsne",
    save_path: Optional[str] = None,
) -> str:
    """
    Visualize gesture embeddings using t-SNE or PCA.

    Args:
        encoder: Trained encoder model.
        student_gestures: Dict of student_id → list of gesture arrays.
        method: 'tsne' or 'pca'.
        save_path: Path to save the plot (PNG).

    Returns:
        Path to saved plot.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning("matplotlib not installed, skipping visualization")
        return ""

    all_embeddings = []
    all_labels = []

    for student_id, gestures in student_gestures.items():
        batch = np.array(gestures)
        embeddings = encoder.predict(batch, verbose=0)
        all_embeddings.append(embeddings)
        all_labels.extend([student_id] * len(embeddings))

    all_embeddings = np.vstack(all_embeddings)

    if method == "tsne":
        from sklearn.manifold import TSNE
        reducer = TSNE(n_components=2, random_state=42, perplexity=min(30, len(all_embeddings) - 1))
    else:
        from sklearn.decomposition import PCA
        reducer = PCA(n_components=2)

    coords = reducer.fit_transform(all_embeddings)

    fig, ax = plt.subplots(figsize=(10, 8))
    unique_labels = list(set(all_labels))
    colors = plt.cm.tab10(np.linspace(0, 1, len(unique_labels)))

    for i, label in enumerate(unique_labels):
        mask = [l == label for l in all_labels]
        ax.scatter(
            coords[mask, 0], coords[mask, 1],
            c=[colors[i]], label=label, alpha=0.7, s=50,
        )

    ax.set_title(f"Gesture Embeddings ({method.upper()})")
    ax.set_xlabel("Component 1")
    ax.set_ylabel("Component 2")
    ax.legend(title="Student", bbox_to_anchor=(1.05, 1), loc="upper left")
    plt.tight_layout()

    if save_path is None:
        save_path = str(SAVED_MODELS_DIR / f"embeddings_{method}.png")

    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close()

    logger.info(f"Embedding visualization saved → {save_path}")
    return save_path





def evaluate_siamese(
    siamese_model,
    encoder,
    test_a: np.ndarray,
    test_b: np.ndarray,
    test_labels: np.ndarray,
) -> Dict:
    """Legacy evaluation — uses Triplet evaluation internally."""
    # If we have pairs, convert to triplet-style evaluation
    return evaluate_triplet(encoder, test_a, test_b, test_labels)


# Type alias for backward compat
from typing import Dict as _Dict
