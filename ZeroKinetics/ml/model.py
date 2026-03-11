"""
ZeroKinetics ML — 1D CNN Model (Biometric Upgrade)

Dual-input architecture:
  Input 1: (250, 11) time series — 6 raw + 2 magnitude + 3 velocity
  Input 2: (66,) statistical feature vector — biometric signature

The statistical vector is concatenated with the CNN output before
the Dense head, forcing the model to learn micro-dynamics that
shape-copiers cannot replicate.
"""

import tensorflow as tf
from tensorflow import keras
from keras import layers, models, optimizers, metrics, regularizers

from utils import TIMESTEPS, NUM_FEATURES, NUM_STAT_FEATURES, setup_logger

logger = setup_logger("model")


def build_model(
    timesteps: int = TIMESTEPS,
    num_features: int = NUM_FEATURES,
    num_stat_features: int = NUM_STAT_FEATURES,
    learning_rate: float = 0.0005,
) -> keras.Model:
    """
    Build biometric 1D CNN with dual inputs.

    Architecture:
        Time-series branch:
            Conv1D(64, 5, same) → BN → MaxPool
            Conv1D(128, 3, same) → BN → MaxPool
            Conv1D(256, 3, same) → BN → GAP

        Statistical branch:
            Input(66) — raw statistical features

        Merged:
            Concatenate(CNN_output, stats)
            Dense(128, relu, L2) → Dropout(0.6)
            Dense(64, relu, L2) → Dropout(0.6)
            Dense(1, sigmoid)
    """

    seq_input = layers.Input(shape=(timesteps, num_features), name="seq_input")

    x = layers.Conv1D(64, kernel_size=5, activation="relu", padding="same", name="conv1d_1")(seq_input)
    x = layers.BatchNormalization(name="bn_1")(x)
    x = layers.MaxPooling1D(pool_size=2, name="maxpool_1")(x)

    x = layers.Conv1D(128, kernel_size=3, activation="relu", padding="same", name="conv1d_2")(x)
    x = layers.BatchNormalization(name="bn_2")(x)
    x = layers.MaxPooling1D(pool_size=2, name="maxpool_2")(x)

    x = layers.Conv1D(256, kernel_size=3, activation="relu", padding="same", name="conv1d_3")(x)
    x = layers.BatchNormalization(name="bn_3")(x)
    x = layers.GlobalAveragePooling1D(name="gap")(x)


    stat_input = layers.Input(shape=(num_stat_features,), name="stat_input")


    merged = layers.Concatenate(name="merge")([x, stat_input])


    z = layers.Dense(
        128, activation="relu",
        kernel_regularizer=regularizers.l2(0.001),
        name="dense_1",
    )(merged)
    z = layers.Dropout(0.6, name="dropout_1")(z)

    z = layers.Dense(
        64, activation="relu",
        kernel_regularizer=regularizers.l2(0.001),
        name="dense_2",
    )(z)
    z = layers.Dropout(0.6, name="dropout_2")(z)

    output = layers.Dense(1, activation="sigmoid", name="output")(z)


    model = models.Model(
        inputs=[seq_input, stat_input],
        outputs=output,
        name="ZeroKinetics_Biometric_CNN",
    )

    model.compile(
        optimizer=optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=[
            "accuracy",
            metrics.Precision(name="precision"),
            metrics.Recall(name="recall"),
            metrics.AUC(name="auc"),
        ],
    )

    logger.info(
        f"Biometric model built: seq=({timesteps}, {num_features}), "
        f"stats=({num_stat_features},), params={model.count_params():,}"
    )

    return model


def load_student_model(model_path: str) -> keras.Model:
    model = keras.models.load_model(model_path)
    logger.info(f"Model loaded from {model_path}")
    return model


if __name__ == "__main__":
    m = build_model()
    m.summary()
