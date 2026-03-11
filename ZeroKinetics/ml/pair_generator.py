"""
ZeroKinetics ML — Triplet Data Generator for Metric Learning

TripletGenerator class that constructs (anchor, positive, negative)
batches using gestures from multiple users with impostor data.

Features:
    • TensorFlow Sequence-based generator for model.fit()
    • Random triplet sampling with user balancing
    • Optional hard-negative mining (uses encoder to find hardest negatives)
    • Gesture caching for fast batch generation
    • Dataset balancing across users

Triplet sampling rules:
    1. Anchor + Positive → same user, different gesture files
    2. Negative (impostor) → different user
    3. Randomized selection for training diversity
"""

import numpy as np
import pandas as pd
from pathlib import Path
from itertools import combinations
from typing import Dict, List, Tuple, Optional

from data_processing import engineer_features, resample_sequence, normalize_independent
from utils import TIMESTEPS, NUM_FEATURES, RAW_FEATURES, EMBEDDING_DIM, setup_logger

logger = setup_logger("pair_generator")




def load_gesture_csv(filepath: Path) -> Optional[np.ndarray]:
    """
    Load a single gesture CSV and return processed (128, 11) array.

    Handles two cases:
        - CSV with 9 features → resample + normalize
        - CSV with 6 raw features → engineer → resample → normalize
    """
    try:
        df = pd.read_csv(filepath)

        for col in ["timestamp", "time", "t"]:
            if col in df.columns:
                df = df.drop(columns=[col])

        data = df.values.astype(np.float32)

        if data.shape[1] == NUM_FEATURES:
            pass  # Already 11 features
        elif data.shape[1] == RAW_FEATURES:
            data = engineer_features(data)  # 6 → 11
        else:
            logger.warning(f"Unexpected columns ({data.shape[1]}) in {filepath}")
            return None

        data = resample_sequence(data, TIMESTEPS)
        data = normalize_independent(data)

        return data.astype(np.float32)

    except Exception as e:
        logger.warning(f"Failed to load {filepath}: {e}")
        return None


def load_dataset(dataset_dir: str) -> Dict[str, List[np.ndarray]]:
    """Load all gestures from the dataset directory."""
    dataset_path = Path(dataset_dir)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    student_gestures: Dict[str, List[np.ndarray]] = {}

    for student_dir in sorted(dataset_path.iterdir()):
        if not student_dir.is_dir():
            continue

        student_id = student_dir.name
        gestures = []

        for csv_file in sorted(student_dir.glob("*.csv")):
            gesture = load_gesture_csv(csv_file)
            if gesture is not None:
                gestures.append(gesture)

        if gestures:
            student_gestures[student_id] = gestures
            logger.info(f"Loaded {len(gestures)} gestures for {student_id}")

    logger.info(
        f"Dataset loaded: {len(student_gestures)} students, "
        f"{sum(len(g) for g in student_gestures.values())} total gestures"
    )
    return student_gestures




class TripletGenerator:
    """
    TensorFlow-compatible triplet batch generator.

    Generates (anchor, positive, negative) triplets with impostor data
    from a multi-user gesture dataset.

    Usage:
        generator = TripletGenerator("dataset/", batch_size=32)
        model.fit(generator, epochs=20, steps_per_epoch=100)

    Features:
        • Balanced sampling across users
        • Optional hard-negative mining
        • Gesture caching for performance
        • Random shuffling each epoch
    """

    def __init__(
        self,
        dataset_dir: Optional[str] = None,
        student_gestures: Optional[Dict[str, List[np.ndarray]]] = None,
        batch_size: int = 32,
        steps_per_epoch: int = 100,
        hard_negative: bool = False,
        encoder=None,
        cache: bool = True,
    ):
        """
        Initialize TripletGenerator.

        Args:
            dataset_dir: Path to dataset folder with user subdirectories.
            student_gestures: Pre-loaded dict of user_id → gesture arrays.
                              Supply either dataset_dir OR student_gestures.
            batch_size: Number of triplets per batch.
            steps_per_epoch: Number of batches per epoch.
            hard_negative: Enable hard-negative mining (requires encoder).
            encoder: Trained encoder model for hard-negative mining.
            cache: Cache preprocessed gesture arrays in memory.
        """
        if student_gestures is not None:
            self._gestures = student_gestures
        elif dataset_dir is not None:
            self._gestures = load_dataset(dataset_dir)
        else:
            raise ValueError("Provide either dataset_dir or student_gestures")

        self._valid_users = [
            uid for uid, g in self._gestures.items() if len(g) >= 2
        ]
        self._all_users = list(self._gestures.keys())

        if len(self._valid_users) < 1:
            raise ValueError("Need at least 1 user with 2+ gestures")
        if len(self._all_users) < 2:
            raise ValueError("Need at least 2 users for negative sampling")

        self.batch_size = batch_size
        self.steps_per_epoch = steps_per_epoch
        self.hard_negative = hard_negative
        self.encoder = encoder
        self._cache_enabled = cache

        self._embedding_cache: Dict[str, np.ndarray] = {}

        first_user = self._all_users[0]
        self._feature_count = self._gestures[first_user][0].shape[1]

        logger.info(
            f"TripletGenerator initialized: "
            f"{len(self._valid_users)} valid users (2+ gestures), "
            f"{len(self._all_users)} total users, "
            f"batch_size={batch_size}, steps={steps_per_epoch}, "
            f"hard_negative={hard_negative}, features={self._feature_count}"
        )

    @property
    def num_users(self) -> int:
        return len(self._all_users)

    @property
    def num_valid_users(self) -> int:
        return len(self._valid_users)

    @property
    def total_gestures(self) -> int:
        return sum(len(g) for g in self._gestures.values())



    def __len__(self) -> int:
        """Number of batches per epoch."""
        return self.steps_per_epoch

    def __iter__(self):
        """Iterate over batches."""
        for _ in range(self.steps_per_epoch):
            yield self._generate_batch()

    def __getitem__(self, idx):
        """Get a single batch (for tf.keras.utils.Sequence compatibility)."""
        return self._generate_batch()

    def __call__(self):
        """Generator function for tf.data.Dataset.from_generator()."""
        while True:
            batch = self._generate_batch()
            yield batch

    def on_epoch_end(self):
        np.random.shuffle(self._valid_users)
        np.random.shuffle(self._all_users)
        if self.hard_negative:
            self._embedding_cache.clear()



    def _generate_batch(self) -> Tuple:
        """
        Generate one batch of triplets.

        Returns:
            ([anchor_batch, positive_batch, negative_batch], dummy_labels)

            anchor_batch:   (batch_size, 128, feature_count)
            positive_batch: (batch_size, 128, feature_count)
            negative_batch: (batch_size, 128, feature_count)
            dummy_labels:   (batch_size, 3 * EMBEDDING_DIM) — zeros, ignored by triplet loss
        """
        anchors = np.zeros((self.batch_size, TIMESTEPS, self._feature_count), dtype=np.float32)
        positives = np.zeros((self.batch_size, TIMESTEPS, self._feature_count), dtype=np.float32)
        negatives = np.zeros((self.batch_size, TIMESTEPS, self._feature_count), dtype=np.float32)

        user_cycle = self._valid_users * ((self.batch_size // len(self._valid_users)) + 1)
        np.random.shuffle(user_cycle)

        for i in range(self.batch_size):
            anchor_user = user_cycle[i]
            user_gestures = self._gestures[anchor_user]

            idx_a, idx_p = np.random.choice(len(user_gestures), 2, replace=False)
            anchors[i] = user_gestures[idx_a]
            positives[i] = user_gestures[idx_p]

            if self.hard_negative and self.encoder is not None:
                negatives[i] = self._hard_negative_sample(
                    anchor_user, user_gestures[idx_a]
                )
            else:
                negatives[i] = self._random_negative_sample(anchor_user)

        dummy_labels = np.zeros((self.batch_size, 3 * EMBEDDING_DIM), dtype=np.float32)

        return [anchors, positives, negatives], dummy_labels

    def _random_negative_sample(self, exclude_user: str) -> np.ndarray:
        """
        Pick a random gesture from a random different user.

        Args:
            exclude_user: User ID to exclude (anchor user).

        Returns:
            Gesture array of shape (128, feature_count).
        """
        neg_candidates = [u for u in self._all_users if u != exclude_user]
        neg_user = np.random.choice(neg_candidates)
        neg_gestures = self._gestures[neg_user]
        return neg_gestures[np.random.randint(len(neg_gestures))]

    def _hard_negative_sample(
        self,
        anchor_user: str,
        anchor_gesture: np.ndarray,
    ) -> np.ndarray:
        """
        Hard-negative mining: find the impostor gesture closest to the anchor.

        This selects the negative that is hardest for the model to distinguish,
        forcing the encoder to learn finer separations.

        Args:
            anchor_user: User ID of the anchor.
            anchor_gesture: Anchor gesture array.

        Returns:
            Hardest negative gesture array.
        """
        anchor_emb = self.encoder.predict(
            anchor_gesture.reshape(1, TIMESTEPS, self._feature_count), verbose=0
        )[0]

        best_negative = None
        best_distance = float("inf")

        neg_users = [u for u in self._all_users if u != anchor_user]
        sample_size = min(len(neg_users), 10)
        sampled_users = np.random.choice(neg_users, sample_size, replace=False)

        for neg_user in sampled_users:
            neg_gestures = self._gestures[neg_user]

            cache_key = neg_user
            if cache_key not in self._embedding_cache:
                batch = np.array(neg_gestures)
                self._embedding_cache[cache_key] = self.encoder.predict(
                    batch, verbose=0
                )

            neg_embeddings = self._embedding_cache[cache_key]

            distances = np.sqrt(np.sum((neg_embeddings - anchor_emb) ** 2, axis=1))
            min_idx = np.argmin(distances)
            min_dist = distances[min_idx]

            if min_dist < best_distance:
                best_distance = min_dist
                best_negative = neg_gestures[min_idx]

        if best_negative is None:
            return self._random_negative_sample(anchor_user)

        return best_negative



    def generate_all(
        self, n_triplets: int,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generate all triplets at once (for small datasets).

        Returns:
            (anchors, positives, negatives) — NumPy arrays.
        """
        anchors = []
        positives = []
        negatives = []

        for _ in range(n_triplets):
            anchor_user = np.random.choice(self._valid_users)
            user_gestures = self._gestures[anchor_user]

            idx_a, idx_p = np.random.choice(len(user_gestures), 2, replace=False)
            anchors.append(user_gestures[idx_a])
            positives.append(user_gestures[idx_p])
            negatives.append(self._random_negative_sample(anchor_user))

        return (
            np.array(anchors, dtype=np.float32),
            np.array(positives, dtype=np.float32),
            np.array(negatives, dtype=np.float32),
        )

    def as_tf_dataset(self, shuffle_buffer: int = 1000):
        """
        Convert to tf.data.Dataset for optimal GPU pipeline.

        Usage:
            ds = generator.as_tf_dataset()
            model.fit(ds, epochs=20, steps_per_epoch=100)
        """
        import tensorflow as tf

        output_signature = (
            (
                tf.TensorSpec(shape=(TIMESTEPS, self._feature_count), dtype=tf.float32),
                tf.TensorSpec(shape=(TIMESTEPS, self._feature_count), dtype=tf.float32),
                tf.TensorSpec(shape=(TIMESTEPS, self._feature_count), dtype=tf.float32),
            ),
            tf.TensorSpec(shape=(3 * EMBEDDING_DIM,), dtype=tf.float32),
        )

        def _single_triplet_generator():
            while True:
                anchor_user = np.random.choice(self._valid_users)
                user_gestures = self._gestures[anchor_user]
                idx_a, idx_p = np.random.choice(len(user_gestures), 2, replace=False)
                negative = self._random_negative_sample(anchor_user)
                dummy = np.zeros(3 * EMBEDDING_DIM, dtype=np.float32)
                yield (
                    user_gestures[idx_a],
                    user_gestures[idx_p],
                    negative,
                ), dummy

        dataset = tf.data.Dataset.from_generator(
            _single_triplet_generator,
            output_signature=output_signature,
        )

        dataset = dataset.shuffle(shuffle_buffer).batch(self.batch_size).prefetch(
            tf.data.AUTOTUNE
        )

        return dataset




def generate_triplets(
    student_gestures: Dict[str, List[np.ndarray]],
    target_triplets: int = 50000,
) -> List[Tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """
    Generate (anchor, positive, negative) triplets.

    For each triplet:
        - anchor & positive are from the SAME student
        - negative is from a DIFFERENT student (impostor)
    """
    student_ids = [sid for sid, gestures in student_gestures.items() if len(gestures) >= 2]
    all_student_ids = list(student_gestures.keys())

    if len(student_ids) < 1:
        raise ValueError("Need at least 1 student with 2+ gestures for triplets")
    if len(all_student_ids) < 2:
        raise ValueError("Need at least 2 students for negative (impostor) sampling")

    logger.info(
        f"Generating {target_triplets} triplets from {len(student_ids)} students "
        f"({len(all_student_ids)} total users)"
    )
    for sid in all_student_ids:
        logger.info(f"  User {sid[:8]}...: {len(student_gestures[sid])} gestures")

    triplets = []
    for i in range(target_triplets):
        anchor_sid = np.random.choice(student_ids)
        anchor_gestures = student_gestures[anchor_sid]
        idx_a, idx_p = np.random.choice(len(anchor_gestures), 2, replace=False)

        neg_candidates = [s for s in all_student_ids if s != anchor_sid]
        neg_sid = np.random.choice(neg_candidates)
        neg_gestures = student_gestures[neg_sid]

        triplets.append((
            anchor_gestures[idx_a],
            anchor_gestures[idx_p],
            neg_gestures[np.random.randint(len(neg_gestures))],
        ))

        if i < 3:
            logger.info(
                f"  Triplet {i}: anchor={anchor_sid[:8]}.. "
                f"positive={anchor_sid[:8]}.. negative={neg_sid[:8]}.."
            )

    logger.info(f"Generated {len(triplets)} triplets from {len(student_ids)} students")
    return triplets


def generate_training_triplets(
    dataset_dir: str,
    target_triplets: int = 50000,
    val_split: float = 0.2,
) -> Dict[str, Tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """Generate training and validation triplet datasets."""
    student_gestures = load_dataset(dataset_dir)
    triplets = generate_triplets(student_gestures, target_triplets)

    anchors = np.array([t[0] for t in triplets])
    positives = np.array([t[1] for t in triplets])
    negatives = np.array([t[2] for t in triplets])

    indices = np.random.permutation(len(triplets))
    anchors, positives, negatives = anchors[indices], positives[indices], negatives[indices]

    n_val = int(len(triplets) * val_split)
    n_train = len(triplets) - n_val

    splits = {
        "train": (anchors[:n_train], positives[:n_train], negatives[:n_train]),
        "val": (anchors[n_train:], positives[n_train:], negatives[n_train:]),
    }

    for name, (a, p, n) in splits.items():
        logger.info(f"{name}: {len(a)} triplets")

    return splits


def generate_triplets_from_samples(
    student_gestures: Dict[str, List[np.ndarray]],
    target_triplets: int = 50000,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate triplets from already-loaded gesture data."""
    total_gestures = sum(len(g) for g in student_gestures.values())
    max_triplets = min(target_triplets, total_gestures * 100)

    triplets = generate_triplets(student_gestures, max_triplets)

    anchors = np.array([t[0] for t in triplets])
    positives = np.array([t[1] for t in triplets])
    negatives = np.array([t[2] for t in triplets])

    indices = np.random.permutation(len(triplets))
    return anchors[indices], positives[indices], negatives[indices]




def generate_positive_pairs(
    student_gestures: Dict[str, List[np.ndarray]],
    max_pairs_per_student: Optional[int] = None,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Legacy — use TripletGenerator or generate_triplets instead."""
    pairs = []
    for student_id, gestures in student_gestures.items():
        if len(gestures) < 2:
            continue
        combos = list(combinations(range(len(gestures)), 2))
        if max_pairs_per_student and len(combos) > max_pairs_per_student:
            indices = np.random.choice(len(combos), max_pairs_per_student, replace=False)
            combos = [combos[i] for i in indices]
        for i, j in combos:
            pairs.append((gestures[i], gestures[j]))
    return pairs


def generate_negative_pairs(
    student_gestures: Dict[str, List[np.ndarray]],
    n_pairs: int,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Legacy — use TripletGenerator or generate_triplets instead."""
    student_ids = list(student_gestures.keys())
    if len(student_ids) < 2:
        raise ValueError("Need at least 2 students for negative pairs")
    pairs = []
    for _ in range(n_pairs):
        sid_a, sid_b = np.random.choice(student_ids, 2, replace=False)
        g_a, g_b = student_gestures[sid_a], student_gestures[sid_b]
        pairs.append((g_a[np.random.randint(len(g_a))], g_b[np.random.randint(len(g_b))]))
    return pairs


def generate_training_pairs(dataset_dir, target_total_pairs=50000, val_split=0.2):
    """Legacy — delegates to generate_training_triplets."""
    return generate_training_triplets(dataset_dir, target_total_pairs, val_split)


def generate_pairs_from_samples(student_gestures, target_total_pairs=50000):
    """Legacy — delegates to generate_triplets_from_samples."""
    return generate_triplets_from_samples(student_gestures, target_total_pairs)
