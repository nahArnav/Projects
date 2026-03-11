"""
ZeroKinetics ML — Production FastAPI Service (Siamese Network)

Endpoints:
  POST /train    — Register a student via Siamese encoder
  POST /predict  — Authenticate via gesture embedding distance
  GET  /health   — Health check

Authentication response format:
  {verified, distance, threshold}
"""

import time
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from contextlib import asynccontextmanager

from utils import setup_logger, MIN_GESTURE_SAMPLES
from embeddings_store import has_embeddings

logger = setup_logger("api")



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ZeroKinetics ML API starting up")
    yield
    logger.info("ZeroKinetics ML API shutting down")


app = FastAPI(
    title="ZeroKinetics ML API",
    version="3.0.0",
    description="Siamese Network gesture biometric authentication",
    lifespan=lifespan,
)




class SensorReading(BaseModel):
    timestamp: float = 0
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class GestureSample(BaseModel):
    data: List[SensorReading]
    duration: Optional[float] = None


class TrainRequest(BaseModel):
    userId: str
    gestureSamples: List[GestureSample]


class TrainResponse(BaseModel):
    modelId: str
    status: str
    message: str
    threshold: Optional[float] = None
    metrics: Optional[Dict] = None


class PredictRequest(BaseModel):
    userId: str
    gestureData: List[SensorReading]


class PredictResponse(BaseModel):
    verified: bool
    distance: float
    threshold: float
    confidence: Optional[float] = None
    message: str
    modelId: Optional[str] = None



@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ZeroKinetics ML API",
        "version": "4.0.0",
    }


@app.post("/train", response_model=TrainResponse)
async def train_endpoint(request: TrainRequest):
    """Register a student via Triplet encoder."""
    start_time = time.time()
    logger.info(
        f"Train request for user {request.userId} "
        f"with {len(request.gestureSamples)} samples"
    )

    if len(request.gestureSamples) < MIN_GESTURE_SAMPLES:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {MIN_GESTURE_SAMPLES} samples required, "
                   f"got {len(request.gestureSamples)}",
        )

    try:
        from train import train_student_model

        samples = [
            {"data": [r.model_dump() for r in sample.data], "duration": sample.duration}
            for sample in request.gestureSamples
        ]

        result = train_student_model(
            student_id=request.userId,
            gesture_samples=samples,
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Training completed for {request.userId} "
            f"in {elapsed:.1f}s — threshold={result['threshold']:.4f}"
        )

        return TrainResponse(
            modelId=result["modelId"],
            status=result["status"],
            message=f"Model trained successfully in {elapsed:.1f}s",
            threshold=result.get("threshold"),
            metrics=result.get("metrics"),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Training failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/predict", response_model=PredictResponse)
async def predict_endpoint(request: PredictRequest):
    """Authenticate via gesture embedding distance."""
    start_time = time.time()
    logger.info(
        f"Predict request for user {request.userId} "
        f"with {len(request.gestureData)} readings"
    )

    if not request.gestureData:
        raise HTTPException(status_code=400, detail="Gesture data is required")

    if len(request.gestureData) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Too few sensor readings ({len(request.gestureData)}). "
                   f"Need at least 10.",
        )

    if not has_embeddings(request.userId):
        logger.warning(f"No embeddings found for user {request.userId}")
        return PredictResponse(
            verified=False,
            distance=999.0,
            threshold=0.35,
            confidence=0.0,
            message=f"No trained model found for user {request.userId}. "
                    f"Please complete gesture enrollment first.",
            modelId=None,
        )

    try:
        from inference import predict_gesture

        gesture_data = [r.model_dump() for r in request.gestureData]

        result = predict_gesture(
            student_id=request.userId,
            gesture_data=gesture_data,
        )

        elapsed = time.time() - start_time

        if "error" in result:
            logger.warning(f"Inference issue for {request.userId}: {result['error']}")
            return PredictResponse(
                verified=False,
                distance=result.get("distance", 999.0),
                threshold=result.get("threshold", 0.35),
                confidence=0.0,
                message=result["error"],
                modelId=f"siamese_{request.userId}",
            )

        logger.info(
            f"Inference for {request.userId}: "
            f"distance={result['distance']:.4f}, verified={result['verified']} "
            f"in {elapsed*1000:.0f}ms"
        )

        return PredictResponse(
            verified=result["verified"],
            distance=result["distance"],
            threshold=result["threshold"],
            confidence=result.get("confidence", 0.0),
            message="Gesture verified" if result["verified"] else "Gesture not verified",
            modelId=f"siamese_{request.userId}",
        )

    except Exception as e:
        logger.error(f"Inference failed: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
