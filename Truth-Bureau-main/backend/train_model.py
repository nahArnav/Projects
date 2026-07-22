"""
Truth Bureau – Model Training Script (VERSION 2)
Fine-tunes DistilBERT on the 186k+ row Ultimate Hybrid Dataset.
Mapped perfectly to preserve V1 Backend Compatibility.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import pandas as pd
import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
)

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("verilens-train-v2")

# ── Constants ────────────────────────────────────────────────────────────────
# Pointing directly to our new master dataset
DATASET_PATH = Path(__file__).resolve().parent.parent / "dataset" / "ultimate_hybrid_dataset.csv"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "trained_model"
BASE_MODEL = "distilbert-base-uncased"
MAX_LENGTH = 256

# MAINTAINING V1 BACKEND COMPATIBILITY: 
# Even though our CSV uses 1=Fake, we map it to match your old FastAPI logic.
LABEL_MAP = {"FAKE": 0, "REAL": 1}
ID_TO_LABEL = {0: "FAKE", 1: "REAL"}


# ── Dataset ──────────────────────────────────────────────────────────────────
def load_ultimate_dataset() -> list[dict]:
    """Loads the Ultimate Hybrid Dataset and maps labels for V1 compatibility."""
    if not DATASET_PATH.exists():
        logger.error(f"Dataset not found at {DATASET_PATH}! Make sure it is in the same folder.")
        sys.exit(1)

    logger.info(f"Loading massive dataset from {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH)

    # 🚨 LABEL FLIPPER FOR BACKEND COMPATIBILITY 🚨
    # Our CSV: 1 = Fake, 0 = Real. 
    # Old Script expects strings: "FAKE" and "REAL".
    df['label_str'] = df['label'].map({1: "FAKE", 0: "REAL"})

    # Convert to the list of dicts the script expects
    samples = []
    for _, row in df.iterrows():
        # Quick safety check to ensure text is a string
        text = str(row['text']).strip()
        if len(text) >= 10: 
            samples.append({"text": text, "label": row['label_str']})

    logger.info(f"Successfully loaded {len(samples)} valid samples.")
    return samples


class NewsDataset(Dataset):
    """PyTorch dataset wrapping tokenized news text."""

    def __init__(self, texts: list[str], labels: list[int], tokenizer, max_length: int):
        # We process texts in smaller batches if it's huge, but HuggingFace handles lists well
        self.encodings = tokenizer(
            texts,
            truncation=True,
            padding="max_length",
            max_length=max_length,
            return_tensors="pt",
        )
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return {
            "input_ids": self.encodings["input_ids"][idx],
            "attention_mask": self.encodings["attention_mask"][idx],
            "labels": self.labels[idx],
        }


# ── Training loop ────────────────────────────────────────────────────────────
def train(
    epochs: int = 3,
    batch_size: int = 16,
    learning_rate: float = 2e-5,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    max_samples: int | None = None,
):
    """Fine-tune DistilBERT on the Ultimate Dataset and save."""

    # 🍎 MACBOOK ACCELERATION ADDED HERE
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
        logger.info("Apple Silicon (MPS) detected! GPU acceleration enabled.")
    else:
        device = torch.device("cpu")
        
    logger.info("Using device: %s", device)

    # ── 1. Load data ─────────────────────────────────────────────────────────
    samples = load_ultimate_dataset()

    if max_samples and len(samples) > max_samples:
        logger.info("Limiting to %d samples (out of %d available).", max_samples, len(samples))
        np.random.seed(42)
        indices = np.random.choice(len(samples), max_samples, replace=False)
        samples = [samples[i] for i in indices]

    texts = [s["text"] for s in samples]
    labels = [LABEL_MAP[s["label"]] for s in samples]

    logger.info(
        "Total samples: %d (FAKE=%d, REAL=%d)",
        len(labels),
        labels.count(0),
        labels.count(1),
    )

    # ── 2. Train/val split ───────────────────────────────────────────────────
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=0.15, random_state=42, stratify=labels,
    )
    logger.info("Train set: %d | Validation set: %d", len(train_texts), len(val_texts))

    # ── 3. Tokenizer & datasets ──────────────────────────────────────────────
    logger.info("Loading tokenizer & base model: %s", BASE_MODEL)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    logger.info("Tokenizing train set (This might take a minute)...")
    train_dataset = NewsDataset(train_texts, train_labels, tokenizer, MAX_LENGTH)
    logger.info("Tokenizing val set...")
    val_dataset = NewsDataset(val_texts, val_labels, tokenizer, MAX_LENGTH)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # ── 4. Model ─────────────────────────────────────────────────────────────
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=2,
        id2label=ID_TO_LABEL,
        label2id=LABEL_MAP,
    )
    model.to(device)

    # ── 5. Optimizer & scheduler ─────────────────────────────────────────────
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    total_steps = len(train_loader) * epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(total_steps * 0.1),
        num_training_steps=total_steps,
    )

    # ── 6. Training ──────────────────────────────────────────────────────────
    best_f1 = 0.0
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        progress = 0

        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            outputs = model(**batch)
            loss = outputs.loss

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()

            total_loss += loss.item()
            progress += 1
            if progress % 50 == 0:
                logger.info(
                    "  Epoch %d/%d – batch %d/%d – loss: %.4f",
                    epoch + 1, epochs, progress, len(train_loader), loss.item(),
                )

        avg_loss = total_loss / len(train_loader)

        # ── Validation ───────────────────────────────────────────────────────
        model.eval()
        all_preds, all_labels = [], []

        with torch.no_grad():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(**batch)
                preds = torch.argmax(outputs.logits, dim=-1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(batch["labels"].cpu().numpy())

        acc = accuracy_score(all_labels, all_preds)
        f1 = f1_score(all_labels, all_preds, average="weighted")

        logger.info(
            "Epoch %d/%d – avg_loss: %.4f – val_acc: %.4f – val_f1: %.4f",
            epoch + 1, epochs, avg_loss, acc, f1,
        )

        # Save best model
        if f1 > best_f1:
            best_f1 = f1
            logger.info("New best F1 (%.4f) – saving model to %s", best_f1, output_dir)
            model.save_pretrained(output_dir)
            tokenizer.save_pretrained(output_dir)

    # ── 7. Final report ──────────────────────────────────────────────────────
    logger.info("\n=== Final Validation Report ===")
    logger.info(
        "\n%s",
        classification_report(
            all_labels, all_preds, target_names=["FAKE", "REAL"],
        ),
    )
    logger.info("Best F1 score: %.4f", best_f1)
    logger.info("Model saved to: %s", output_dir.resolve())


# ── CLI ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Train Truth Bureau fake news classifier (V2)")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument(
        "--output-dir", type=str, default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory to save trained model (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--max-samples", type=int, default=None,
        help="Limit total samples for faster experimentation",
    )
    args = parser.parse_args()

    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        output_dir=args.output_dir,
        max_samples=args.max_samples,
    )

if __name__ == "__main__":
    main()