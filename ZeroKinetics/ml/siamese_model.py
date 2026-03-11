"""
ZeroKinetics ML — Triplet Network Architecture

Shared 1D CNN encoder produces 128-dim L2-normalized embeddings
for behavioral biometric gesture authentication.

Encoder architecture:
    Conv1D(64, 3, relu) → BN → MaxPool
    Conv1D(128, 3, relu) → BN → MaxPool
    Conv1D(256, 3, relu) → BN
    GlobalAveragePooling1D
    Dense(256, relu)
    Dense(128) → L2-normalize → final embedding

Triplet Network:
    3 inputs: anchor, positive, negative
    Shared encoder → 3 embeddings
    Triplet loss with margin 0.3

Authentication:
    distance = euclidean(embedding_A, embedding_B)
    distance < threshold → verified
"""

import tensorflow as tf
from tensorflow import keras
from keras import layers, models, optimizers

from contrastive_loss import make_triplet_loss
from utils import (
    TIMESTEPS, NUM_FEATURES, EMBEDDING_DIM, TRIPLET_MARGIN,
    CONTRASTIVE_MARGIN, setup_logger,
)

logger = setup_logger("siamese_model")


class L2Normalize(layers.Layer):
    """L2-normalize along the feature axis. Serializes correctly unlike Lambda."""

    def call(self, inputs):
        return tf.math.l2_normalize(inputs, axis=1)

    def get_config(self):
        return super().get_config()


def build_encoder(
    timesteps: int = TIMESTEPS,
    num_features: int = NUM_FEATURES,
    embedding_dim: int = EMBEDDING_DIM,
    name: str = "gesture_encoder",
) -> keras.Model:
    """
    Build the shared 1D CNN encoder.

    Input:  (128, 11)
    Output: (128,) — L2-normalized embedding vector
    """
    inp = layers.Input(shape=(timesteps, num_features), name="gesture_input")

    x = layers.Conv1D(64, kernel_size=3, activation="relu", padding="same", name="conv1d_1")(inp)
    x = layers.BatchNormalization(name="bn_1")(x)
    x = layers.MaxPooling1D(pool_size=2, name="maxpool_1")(x)

    x = layers.Conv1D(128, kernel_size=3, activation="relu", padding="same", name="conv1d_2")(x)
    x = layers.BatchNormalization(name="bn_2")(x)
    x = layers.MaxPooling1D(pool_size=2, name="maxpool_2")(x)

    x = layers.Conv1D(256, kernel_size=3, activation="relu", padding="same", name="conv1d_3")(x)
    x = layers.BatchNormalization(name="bn_3")(x)
    x = layers.GlobalAveragePooling1D(name="gap")(x)

    x = layers.Dense(256, activation="relu", name="dense_256")(x)
    x = layers.Dense(embedding_dim, name="embedding_raw")(x)
    x = L2Normalize(name="embedding")(x)

    encoder = models.Model(inputs=inp, outputs=x, name=name)

    logger.info(
        f"Encoder built: input=({timesteps}, {num_features}), "
        f"embedding_dim={embedding_dim}, params={encoder.count_params():,}"
    )
    return encoder


def euclidean_distance(vectors):
    """Compute Euclidean distance between two embedding vectors."""
    emb_a, emb_b = vectors
    sum_squared = tf.reduce_sum(tf.square(emb_a - emb_b), axis=1, keepdims=True)
    return tf.sqrt(tf.maximum(sum_squared, tf.keras.backend.epsilon()))


def build_triplet_model(
    timesteps: int = TIMESTEPS,
    num_features: int = NUM_FEATURES,
    embedding_dim: int = EMBEDDING_DIM,
    learning_rate: float = 0.001,
    margin: float = TRIPLET_MARGIN,
) -> tuple:
    """
    Build the Triplet Network with shared encoder.

    Three inputs pass through the same encoder:
        anchor   → anchor_embedding
        positive → positive_embedding
        negative → negative_embedding

    Output: concatenated [anchor_emb, positive_emb, negative_emb]
    Loss: triplet loss with configurable margin.

    Returns:
        (triplet_model, encoder)
    """
    encoder = build_encoder(timesteps, num_features, embedding_dim)

    anchor_input = layers.Input(shape=(timesteps, num_features), name="anchor_input")
    positive_input = layers.Input(shape=(timesteps, num_features), name="positive_input")
    negative_input = layers.Input(shape=(timesteps, num_features), name="negative_input")

    anchor_embedding = encoder(anchor_input)
    positive_embedding = encoder(positive_input)
    negative_embedding = encoder(negative_input)

    output = layers.Concatenate(name="triplet_output")(
        [anchor_embedding, positive_embedding, negative_embedding]
    )

    triplet = models.Model(
        inputs=[anchor_input, positive_input, negative_input],
        outputs=output,
        name="ZeroKinetics_Triplet",
    )

    triplet.compile(
        optimizer=optimizers.Adam(learning_rate=learning_rate),
        loss=make_triplet_loss(margin=margin),
    )

    logger.info(
        f"Triplet model built: total_params={triplet.count_params():,}, "
        f"lr={learning_rate}, margin={margin}"
    )

    return triplet, encoder


def build_siamese_model(
    timesteps: int = TIMESTEPS,
    num_features: int = NUM_FEATURES,
    embedding_dim: int = EMBEDDING_DIM,
    learning_rate: float = 0.001,
    margin: float = CONTRASTIVE_MARGIN,
) -> tuple:
    """
    Build the full Siamese network with shared encoder (legacy).
    Delegates to build_triplet_model for all new usage.
    """
    return build_triplet_model(
        timesteps, num_features, embedding_dim,
        learning_rate, TRIPLET_MARGIN,
    )


def load_encoder(encoder_path: str) -> keras.Model:
    """Load a saved encoder model."""
    from keras.layers import Dense

    _original_from_config = Dense.from_config

    def _patched_from_config(config):
        config.pop("quantization_config", None)
        return _original_from_config(config)

    Dense.from_config = _patched_from_config
    try:
        encoder = keras.models.load_model(
            encoder_path, compile=False,
            custom_objects={"L2Normalize": L2Normalize, "tf": tf},
        )
    finally:
        Dense.from_config = _original_from_config

    logger.info(f"Encoder loaded from {encoder_path}")
    return encoder


def load_triplet_model(triplet_path: str, margin: float = TRIPLET_MARGIN) -> keras.Model:
    """Load a saved Triplet model with custom loss."""
    triplet = keras.models.load_model(
        triplet_path,
        custom_objects={
            "triplet_loss": make_triplet_loss(margin),
        },
    )
    logger.info(f"Triplet model loaded from {triplet_path}")
    return triplet


def load_siamese(siamese_path: str, margin: float = CONTRASTIVE_MARGIN) -> keras.Model:
    """Legacy loader — delegates to load_triplet_model."""
    return load_triplet_model(siamese_path, TRIPLET_MARGIN)


if __name__ == "__main__":
    triplet, encoder = build_triplet_model()
    print("\n=== Encoder ===")
    encoder.summary()
    print("\n=== Triplet Model ===")
    triplet.summary()
