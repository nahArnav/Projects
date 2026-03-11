import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from siamese_model import build_encoder, load_encoder, L2Normalize
from utils import SAVED_MODELS_DIR, setup_logger

logger = setup_logger("upgrade_models")

def upgrade_encoder():
    # Target both potential names
    target_files = ["zerokinetics_encoder.h5", "encoder_shared.h5"]
    
    for filename in target_files:
        encoder_path = os.path.join(SAVED_MODELS_DIR, filename)
        if not os.path.exists(encoder_path):
            logger.info(f"Skipping {filename} (not found)")
            continue

        logger.info(f"--- Upgrading {filename} ---")
        try:
            # load_encoder is already patched to handle 'tf' in custom_objects
            old_model = load_encoder(encoder_path)
        except Exception as e:
            logger.error(f"Failed to load {encoder_path}: {e}")
            continue
        
        logger.info("Building new encoder with L2Normalize layer")
        new_model = build_encoder()
        
        logger.info("Copying weights from old model to new model")
        for new_layer in new_model.layers:
            try:
                old_layer = old_model.get_layer(new_layer.name)
                if old_layer.get_weights():
                    logger.debug(f"Copying weights for {new_layer.name}")
                    new_layer.set_weights(old_layer.get_weights())
            except ValueError:
                logger.warning(f"Layer {new_layer.name} not found in old model")

        # Verify new model works
        dummy_input = np.random.random((1, 128, 11)).astype(np.float32)
        new_output = new_model.predict(dummy_input, verbose=0)
        logger.info(f"New model verification: output shape = {new_output.shape}")
        
        logger.info(f"Saving upgraded encoder to {encoder_path}")
        new_model.save(encoder_path)
        logger.info(f"Successfully upgraded {filename}")

if __name__ == "__main__":
    upgrade_encoder()
