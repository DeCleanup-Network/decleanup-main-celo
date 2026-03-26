"""
Local GPU inference stub (YOLO-style JSON) for ML verification development.
Matches frontend/src/lib/dmrv/gpu-verification.ts: POST /infer, multipart field "file",
Authorization: Bearer <GPU_SHARED_SECRET> when SHARED_SECRET is set.

Run: ./start.sh   or   uvicorn main:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import hashlib
import os
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

app = FastAPI(title="DeCleanup GPU Inference (dev stub)")

SHARED_SECRET = (
    os.environ.get("SHARED_SECRET")
    or os.environ.get("GPU_SHARED_SECRET")
    or ""
)

security = HTTPBearer(auto_error=False)


def check_bearer(credentials: HTTPAuthorizationCredentials | None) -> None:
    if not SHARED_SECRET:
        return
    token = credentials.credentials if credentials else ""
    if token != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "auth": "required" if SHARED_SECRET else "disabled"}


@app.post("/infer")
async def infer(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    check_bearer(credentials)
    data = await file.read()
    # Deterministic fake counts from bytes (no ML deps)
    h = hashlib.sha256(data).hexdigest()
    n = int(h[:8], 16)
    object_count = (n % 40) + 1
    mean_confidence = 0.45 + (n % 50) / 200.0
    return {
        "object_count": object_count,
        "mean_confidence": round(mean_confidence, 4),
    }
