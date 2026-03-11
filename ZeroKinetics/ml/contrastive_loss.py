"""
ZeroKinetics ML — Triplet Loss for Metric Learning

Triplet Loss formula:
    L = max(d(anchor, positive) - d(anchor, negative) + margin, 0)

Where:
    d = Euclidean distance between L2-normalized embeddings
    margin = minimum gap between positive and negative distances (default 0.5)
"""

import tensorflow as tf

from utils import TRIPLET_MARGIN, setup_logger

logger = setup_logger("triplet_loss")


def triplet_loss(anchor, positive, negative, margin=TRIPLET_MARGIN):
    """
    Compute triplet loss with distance diagnostics.

    Args:
        anchor: Anchor embeddings (batch, embedding_dim).
        positive: Positive embeddings (same user as anchor).
        negative: Negative embeddings (different user).
        margin: Minimum gap between pos/neg distances.

    Returns:
        Scalar loss value.
    """
    d_pos = tf.sqrt(tf.reduce_sum(tf.square(anchor - positive), axis=1) + 1e-8)
    d_neg = tf.sqrt(tf.reduce_sum(tf.square(anchor - negative), axis=1) + 1e-8)

    loss_per_sample = tf.maximum(d_pos - d_neg + margin, 0.0)

    active_fraction = tf.reduce_mean(
        tf.cast(loss_per_sample > 1e-6, tf.float32)
    )

    tf.debugging.assert_all_finite(d_pos, "d_pos contains NaN/Inf")
    tf.debugging.assert_all_finite(d_neg, "d_neg contains NaN/Inf")

    return tf.reduce_mean(loss_per_sample)


def make_triplet_loss(margin=TRIPLET_MARGIN):
    """
    Factory to create a triplet loss function for Keras model.compile().

    The model output is expected to be a concatenation of:
        [anchor_embedding, positive_embedding, negative_embedding]

    y_true (dummy labels) is ignored.
    """
    def loss_fn(y_true, y_pred):
        embedding_dim = tf.shape(y_pred)[1] // 3
        anchor = y_pred[:, :embedding_dim]
        positive = y_pred[:, embedding_dim:2 * embedding_dim]
        negative = y_pred[:, 2 * embedding_dim:]
        return triplet_loss(anchor, positive, negative, margin=margin)

    loss_fn.__name__ = "triplet_loss"
    return loss_fn
