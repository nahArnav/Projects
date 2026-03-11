"""
ZeroKinetics ML Inference Stub

This is a placeholder ML API that mimics the contract of the real
per-student 1D CNN model. Replace this with your actual deployed model.

Endpoints:
  POST /predict  — returns probability score for gesture verification
  POST /train    — accepts gesture samples for model training
  GET  /health   — health check
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random
import uuid

app = FastAPI(
    title="ZeroKinetics ML API (Stub)",
    version="1.0.0",
    description="Stub ML inference server for gesture authentication",
)


class SensorReading(BaseModel):
    timestamp: float
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class PredictRequest(BaseModel):
    userId: str
    gestureData: List[SensorReading]


class PredictResponse(BaseModel):
    probability: float
    modelId: Optional[str] = None
    message: str


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


# In-memory model registry (stub)
trained_models = {}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ZeroKinetics ML Stub"}


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Stub prediction endpoint.
    In production, this loads the per-student model and runs inference
    on the gesture data. Here it returns a mock probability.
    """
    if not request.gestureData:
        raise HTTPException(status_code=400, detail="Gesture data is required")

    # Simulate ML inference with a random probability
    # In production: load model for userId, preprocess data, run inference
    if request.userId in trained_models:
        # User has a "trained" model — return higher probability
        probability = round(random.uniform(0.65, 0.98), 4)
    else:
        # No model — return lower probability
        probability = round(random.uniform(0.10, 0.50), 4)

    return PredictResponse(
        probability=probability,
        modelId=trained_models.get(request.userId),
        message="Stub inference — replace with real model",
    )


@app.post("/train", response_model=TrainResponse)
async def train(request: TrainRequest):
    """
    Stub training endpoint.
    In production, this triggers per-student model training.
    """
    if len(request.gestureSamples) < 50:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum 50 samples required, got {len(request.gestureSamples)}",
        )

    model_id = f"model_{request.userId}_{uuid.uuid4().hex[:8]}"
    trained_models[request.userId] = model_id

    return TrainResponse(
        modelId=model_id,
        status="completed",
        message=f"Stub training completed with {len(request.gestureSamples)} samples",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
