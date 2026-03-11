"""
ZeroKinetics ML — Data Processing Pipeline (Triplet Network)

Behavioral biometric feature engineering:
  1. Accelerometer magnitude:     sqrt(ax² + ay² + az²)
  2. Gyroscope magnitude:         sqrt(gx² + gy² + gz²)
  3. Per-axis jerk (acc derivative): jerkX, jerkY, jerkZ
  4. Resampling to fixed 128 timesteps
  5. Independent normalization per gesture

Final feature vector per timestep:
  [ax, ay, az, gx, gy, gz, acc_mag, gyro_mag, jerkX, jerkY, jerkZ]

Input shape: (128, 11)
"""

import numpy as np
from scipy.interpolate import interp1d
from typing import List, Tuple

from utils import TIMESTEPS, RAW_FEATURES, NUM_FEATURES, SAMPLING_RATE_HZ, setup_logger

logger = setup_logger("data_processing")




def compute_velocity_magnitude(data: np.ndarray) -> np.ndarray:
    """
    Compute accelerometer magnitude.
    acc_mag = sqrt(ax² + ay² + az²)
    """
    acc = data[:, :3]
    return np.sqrt(np.sum(acc ** 2, axis=1, keepdims=True))


def compute_angular_velocity_magnitude(data: np.ndarray) -> np.ndarray:
    """
    Compute gyroscope magnitude.
    gyro_mag = sqrt(gx² + gy² + gz²)
    """
    gyro = data[:, 3:6]
    return np.sqrt(np.sum(gyro ** 2, axis=1, keepdims=True))


def compute_jerk(data: np.ndarray, dt: float = 1.0 / SAMPLING_RATE_HZ) -> np.ndarray:
    """
    Compute per-axis jerk (derivative of acceleration over time).
    Returns [jerkX, jerkY, jerkZ] — captures user-specific motion dynamics.
    """
    jerk_x = np.gradient(data[:, 0], dt).reshape(-1, 1)
    jerk_y = np.gradient(data[:, 1], dt).reshape(-1, 1)
    jerk_z = np.gradient(data[:, 2], dt).reshape(-1, 1)
    return np.hstack([jerk_x, jerk_y, jerk_z])


def engineer_features(raw_6ch: np.ndarray) -> np.ndarray:
    """
    Full feature engineering pipeline.
      (timesteps, 6) → (timesteps, 11)

    Features: [ax, ay, az, gx, gy, gz, acc_mag, gyro_mag, jerkX, jerkY, jerkZ]
    """
    acc_mag = compute_velocity_magnitude(raw_6ch)
    gyro_mag = compute_angular_velocity_magnitude(raw_6ch)
    jerk = compute_jerk(raw_6ch)

    return np.hstack([raw_6ch, acc_mag, gyro_mag, jerk]).astype(np.float32)




def resample_sequence(data: np.ndarray, target_len: int = TIMESTEPS) -> np.ndarray:
    """
    Resample a gesture sequence to fixed length using interpolation.

    Input:  (variable_timesteps, features)
    Output: (target_len, features)
    """
    current_len = data.shape[0]

    if current_len == target_len:
        return data

    x_original = np.linspace(0, 1, current_len)
    x_target = np.linspace(0, 1, target_len)

    resampled = np.zeros((target_len, data.shape[1]), dtype=np.float32)
    for ch in range(data.shape[1]):
        interpolator = interp1d(x_original, data[:, ch], kind='linear')
        resampled[:, ch] = interpolator(x_target)

    return resampled


def pad_or_truncate(data: np.ndarray, target_len: int = TIMESTEPS) -> np.ndarray:
    """Fallback: pad or truncate to fixed length."""
    if data.shape[0] == target_len:
        return data
    elif data.shape[0] > target_len:
        return data[:target_len, :]
    else:
        padding = np.zeros((target_len - data.shape[0], data.shape[1]))
        return np.vstack([data, padding])




def normalize_independent(data: np.ndarray) -> np.ndarray:
    """
    Normalize a single gesture independently: x = (x - mean) / std.
    Each gesture is normalized by its own channel-wise statistics.
    """
    mean = np.mean(data, axis=0, keepdims=True)
    std = np.std(data, axis=0, keepdims=True) + 1e-8
    return (data - mean) / std



def augment_gaussian_noise(data: np.ndarray, noise_std: float = 0.015) -> np.ndarray:
    return data + np.random.normal(0, noise_std, data.shape)

def augment_time_shift(data: np.ndarray, max_shift: int = 5) -> np.ndarray:
    shift = np.random.randint(-max_shift, max_shift + 1)
    return np.roll(data, shift, axis=0)

def augment_amplitude_scale(data: np.ndarray, scale_range: Tuple[float, float] = (0.93, 1.07)) -> np.ndarray:
    scale = np.random.uniform(scale_range[0], scale_range[1])
    return data * scale

def augment_sample(data: np.ndarray) -> np.ndarray:
    augmented = data.copy()
    if np.random.random() > 0.5:
        augmented = augment_gaussian_noise(augmented)
    if np.random.random() > 0.5:
        augmented = augment_time_shift(augmented)
    if np.random.random() > 0.5:
        augmented = augment_amplitude_scale(augmented)
    return augmented

def generate_augmented_samples(samples: List[np.ndarray], factor: int = 2) -> List[np.ndarray]:
    augmented = []
    for sample in samples:
        for _ in range(factor):
            augmented.append(augment_sample(sample))
    return augmented




def preprocess_gesture(
    raw_data: np.ndarray,
    apply_resample: bool = True,
) -> np.ndarray:
    """
    Full preprocessing for a single gesture.

    Pipeline: raw (T, 6) → engineer (T, 11) → resample (128, 11) → normalize
    Returns: (128, 11) array.
    """
    data = raw_data.copy().astype(np.float32)


    data = engineer_features(data)


    if apply_resample:
        data = resample_sequence(data, TIMESTEPS)
    else:
        data = pad_or_truncate(data, TIMESTEPS)


    data = normalize_independent(data)

    return data.astype(np.float32)


def preprocess_batch(
    raw_samples: List[np.ndarray],
    augment: bool = False,
    augmentation_factor: int = 2,
) -> np.ndarray:
    """
    Preprocess a batch of gesture samples.

    Returns:
        X: (N, 128, 11) array
    """
    sequences = []
    for sample in raw_samples:
        seq = preprocess_gesture(sample)
        sequences.append(seq)

    if augment:
        aug_seqs = generate_augmented_samples(sequences, augmentation_factor)
        for aug_seq in aug_seqs:
            aug_seq = normalize_independent(aug_seq)
            sequences.append(aug_seq)

    return np.array(sequences)




def convert_sensor_readings_to_array(readings: list) -> np.ndarray:
    """Convert API sensor reading dicts/objects to numpy array (timesteps, 6)."""
    data = []
    for r in readings:
        if isinstance(r, dict):
            data.append([
                r.get("ax", 0), r.get("ay", 0), r.get("az", 0),
                r.get("gx", 0), r.get("gy", 0), r.get("gz", 0),
            ])
        else:
            data.append([r.ax, r.ay, r.az, r.gx, r.gy, r.gz])
    return np.array(data, dtype=np.float32)
