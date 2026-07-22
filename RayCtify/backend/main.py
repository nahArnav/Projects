from __future__ import annotations

import gc
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response

# BHAU: Changed to absolute imports so the Docker container can find them
from schemas import RecordEnvelope
from services.audit_service import compare_records, evaluate_reference_records, evaluate_user_records
from services.feature_catalog import reference_schema, schema_for_features
from services.model_loader import load_model_from_upload


class RayCtifiedWrapper:
    def __init__(self, base_estimator):
        self.base_estimator = base_estimator
        self.is_rayctified = True
            
    @property
    def _engine(self):
        # Safe lookup: Check __dict__ directly to avoid triggering __getattr__ recursion
        if "base_estimator" in self.__dict__:
            return self.base_estimator
        if "base_model" in self.__dict__:
            return self.base_model
        return None

    def __getattr__(self, name):
        # Only proxy essential ML properties to avoid leaking hidden metadata fields to the UI
        whitelist = ['feature_names_in_', 'n_features_in_', 'classes_', 'n_outputs_']
        if name in whitelist:
            return getattr(self._engine, name)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    def _clean(self, X):
        import pandas as pd
        if isinstance(X, pd.DataFrame):
            X_clean = X.copy()
            # 1. Fill missing columns with 0
            engine = self._engine
            if engine is not None and hasattr(engine, "feature_names_in_"):
                for col in engine.feature_names_in_:
                    if col not in X_clean.columns:
                        X_clean[col] = 0
            # 2. Smart neutralization
            sensitive_keywords = ['race', 'gender', 'sex', 'ethnicity', 'minority', 'demographic', 'age']
            for col in X_clean.columns:
                col_normalized = str(col).lower()
                if any(keyword in col_normalized for keyword in sensitive_keywords):
                    X_clean[col] = 0
            # 3. Ensure exact column order
            if engine is not None and hasattr(engine, "feature_names_in_"):
                valid_cols = [c for c in engine.feature_names_in_ if c in X_clean.columns]
                X_clean = X_clean[valid_cols]
            return X_clean
        return X

    def predict(self, X, *args, **kwargs):
        kwargs.pop('sensitive_features', None)
        X_clean = self._clean(X)
        
        # INSTITUTIONAL POLICY GUARDRAIL
        import pandas as pd
        if isinstance(X_clean, pd.DataFrame):
            # Check for Credit Score columns
            cs_col = next((c for c in X_clean.columns if 'credit' in c.lower()), None)
            if cs_col:
                # If score is below 500, trigger automatic 'Rejected' (assuming 0 is Reject)
                if (X_clean[cs_col] < 500).any():
                    import numpy as np
                    return np.array([0] * len(X_clean))
        
        return self._engine.predict(X_clean, *args, **kwargs)

    def predict_proba(self, X, *args, **kwargs):
        kwargs.pop('sensitive_features', None)
        X_clean = self._clean(X)
        
        engine = self._engine
        if hasattr(engine, 'predict_proba'):
            probs = engine.predict_proba(X_clean, *args, **kwargs)
        else:
            preds = engine.predict(X_clean, *args, **kwargs)
            probs = [[1.0 - float(p), float(p)] for p in preds]
            
        # INSTITUTIONAL POLICY GUARDRAIL (Row-by-Row Safe)
        import pandas as pd
        import numpy as np
        if isinstance(X_clean, pd.DataFrame):
            cs_col = next((c for c in X_clean.columns if 'credit' in c.lower()), None)
            if cs_col is not None:
                mask = (X_clean[cs_col] < 500).values
                if mask.any():
                    probs = np.array(probs)
                    probs[mask] = [1.0, 0.0]
                    
        return np.array(probs)


def _parse_allowed_origins() -> list[str]:
    configured = os.getenv("RAYCTIFY_ALLOWED_ORIGIN", "https://rayctify.arnavpatidar.com")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def _parse_allowed_hosts() -> list[str]:
    # We keep this for local use, but use "*" in the middleware for Cloud Run compatibility
    public_host = os.getenv("RAYCTIFY_PUBLIC_HOST", "localhost")
    return ["127.0.0.1", "localhost", public_host]


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    gc.collect()


app = FastAPI(
    title="RayCtify API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# BHAU: Set to "*" so Google Cloud can perform its health checks and routing
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["X-RayCtify-Session-Mode"] = "memory-only"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


def _deserialize_records(payload_json: str) -> list[dict]:
    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Malformed JSON payload supplied for evaluation.") from exc
    envelope = RecordEnvelope.model_validate(payload)
    return envelope.records


@app.get("/api/v1/health")
async def health() -> dict:
    return {"status": "ok", "mode": "memory-only"}


@app.get("/api/v1/reference/schema")
async def get_reference_schema() -> dict:
    return {
        "schema": reference_schema(),
        "summary": "Financial-only underwriting controls without demographic or proxy variables.",
    }


@app.post("/api/v1/auditor/introspect")
async def auditor_introspect(model_file: UploadFile = File(...)) -> dict:
    loaded_model = None

    try:
        loaded_model = await load_model_from_upload(model_file)
        schema = schema_for_features(loaded_model.feature_names)
        return {
            "engine": loaded_model.engine,
            "model_type": loaded_model.model_type,
            "schema": schema,
            "summary": (
                f"Extracted {len(schema)} parameters from {model_file.filename or 'uploaded model'} and prepared "
                "a secure, session-only testing surface."
            ),
        }
    finally:
        if loaded_model is not None:
            loaded_model.dispose()
        await model_file.close()
        gc.collect()


@app.post("/api/v1/auditor/evaluate")
async def auditor_evaluate(
    model_file: UploadFile = File(...),
    payload_json: str = Form(...),
) -> dict:
    loaded_model = None

    try:
        records = _deserialize_records(payload_json)
        loaded_model = await load_model_from_upload(model_file)
        return {"model_type": loaded_model.model_type, "records": evaluate_user_records(loaded_model, records)}
    finally:
        if loaded_model is not None:
            loaded_model.dispose()
        await model_file.close()
        gc.collect()


@app.post("/api/v1/reference/evaluate")
async def reference_evaluate(payload: RecordEnvelope) -> dict:
    return {"records": evaluate_reference_records(payload.records)}


@app.post("/api/v1/interceptor/heal")
async def interceptor_heal(model_file: UploadFile = File(...)) -> Response:
    loaded_model = None

    try:
        import pickle
        loaded_model = await load_model_from_upload(model_file)
        
        # Wrap the extracted base model using the globally defined class
        wrapped_model = RayCtifiedWrapper(getattr(loaded_model, 'model', loaded_model))
        
        # Serialize the wrapped model into bytes
        model_bytes = pickle.dumps(wrapped_model)

        original_name = model_file.filename or "rayctified_model.pkl"
        original_path = Path(original_name)
        original_stem = original_path.stem or "rayctified_model"
        original_suffix = original_path.suffix.lower()
        export_suffix = (
            ".pkl"
            if original_suffix in {".pkl", ".pickle", ".joblib"}
            else original_suffix or ".bin"
        )
        export_name = f"{original_stem}-rayctified{export_suffix}"

        return Response(
            content=model_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{export_name}"'},
        )
    finally:
        if loaded_model is not None:
            loaded_model.dispose()
        await model_file.close()
        gc.collect()


@app.post("/api/v1/arena/compare")
async def arena_compare(
    model_file: UploadFile = File(...),
    payload_json: str = Form(...),
) -> dict:
    loaded_model = None

    try:
        records = _deserialize_records(payload_json)
        loaded_model = await load_model_from_upload(model_file)
        return {"model_type": loaded_model.model_type, "records": compare_records(loaded_model, records)}
    finally:
        if loaded_model is not None:
            loaded_model.dispose()
        await model_file.close()
        gc.collect()

# BHAU: Added this small block to ensure Port 8080 is always honored
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)