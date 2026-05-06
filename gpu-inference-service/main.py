"""
GPU Inference Service for DeCleanup ML Verification
Runs YOLOv8 fine-tuned on TACO dataset for waste detection
"""

import os
import json
import logging
from typing import List, Optional
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import requests
from PIL import Image
import io
import numpy as np

from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="DeCleanup GPU Inference Service",
    description="YOLOv8 waste detection inference service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model: Optional[YOLO] = None
# Model configuration:
# - If MODEL_PATH is set and file exists, use that model
# - Otherwise, use default YOLOv8 (yolov8n.pt) - auto-downloads on first use
# Recommended custom models:
# 1. TACO fine-tuned: https://github.com/jeremy-rico/litter-detection
# 2. detect-waste: https://huggingface.co/Yorai/detect-waste
# 3. waste-detection: https://huggingface.co/sharktide/waste-detection
MODEL_PATH = os.getenv("MODEL_PATH", "")  # Empty = use default YOLOv8
MODEL_VERSION = os.getenv("MODEL_VERSION", "yolov8n-default")
SHARED_SECRET = os.getenv("SHARED_SECRET", "")  # For request validation

# Model download URLs (for auto-download if not present)
# Note: These are example URLs - actual model files may be at different locations
# Recommended: Download manually from the repos listed in README
MODEL_URLS = {
    # TACO fine-tuned (check releases for actual URL)
    "yolov8-taco": "https://github.com/jeremy-rico/litter-detection/releases/download/v1.0/yolov8-taco.pt",
    # waste-detection (check HuggingFace model files for actual URL)
    "yolov8-waste": "https://huggingface.co/sharktide/waste-detection/resolve/main/best.pt",
}

# Request/Response models
class InferenceRequest(BaseModel):
    submissionId: str = Field(..., description="Unique submission identifier")
    imageUrl: str = Field(..., description="URL to download image from")
    phase: str = Field(..., description="'before' or 'after'", pattern="^(before|after)$")

class DetectedObject(BaseModel):
    class_name: str = Field(..., description="Detected class name", alias="class")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    bbox: List[float] = Field(..., min_items=4, max_items=4, description="[x, y, width, height]")
    
    class Config:
        populate_by_name = True

class InferenceResponse(BaseModel):
    submissionId: str
    phase: str
    objects: List[DetectedObject]
    objectCount: int
    meanConfidence: float
    modelVersion: str

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_version": MODEL_VERSION if model else None
    }

# Load model on startup
def download_model_if_needed(model_path: str) -> str:
    """Download model from URL if not present locally"""
    if os.path.exists(model_path):
        return model_path
    
    # Try to download from known URLs
    model_name = os.path.basename(model_path).replace('.pt', '')
    if model_name in MODEL_URLS:
        logger.info(f"Model not found locally. Attempting to download from {MODEL_URLS[model_name]}...")
        try:
            response = requests.get(MODEL_URLS[model_name], timeout=300)
            response.raise_for_status()
            
            os.makedirs(os.path.dirname(model_path) if os.path.dirname(model_path) else '.', exist_ok=True)
            with open(model_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Model downloaded successfully to {model_path}")
            return model_path
        except Exception as e:
            logger.warning(f"Failed to download model: {e}. Will use default.")
    
    return None

@app.on_event("startup")
async def load_model():
    """Load YOLOv8 model on service startup"""
    global model
    try:
        # Use default YOLOv8 if MODEL_PATH is not set or empty
        if not MODEL_PATH or MODEL_PATH.strip() == "":
            logger.info("No custom model specified. Using default YOLOv8 (yolov8n.pt)...")
            logger.info("This model will be auto-downloaded on first use.")
            model = YOLO("yolov8n.pt")  # Default YOLOv8 nano model
            logger.info(f"Default YOLOv8 model loaded. Version: {MODEL_VERSION}")
        else:
            logger.info(f"Loading custom YOLOv8 model from {MODEL_PATH}...")
            
            # Try to download model if not present
            actual_model_path = download_model_if_needed(MODEL_PATH)
            
            if not actual_model_path or not os.path.exists(actual_model_path):
                logger.warning(f"Custom model file not found at {MODEL_PATH}. Falling back to default yolov8n.")
                logger.info("To use a custom model:")
                logger.info("  - TACO: https://github.com/jeremy-rico/litter-detection")
                logger.info("  - detect-waste: https://huggingface.co/Yorai/detect-waste")
                logger.info("  - waste-detection: https://huggingface.co/sharktide/waste-detection")
                model = YOLO("yolov8n.pt")  # Fallback to default model
            else:
                model = YOLO(actual_model_path)
                logger.info(f"Custom model loaded successfully. Version: {MODEL_VERSION}")
        
        logger.info(f"Model classes: {len(model.names) if hasattr(model, 'names') else 'unknown'}")
        
        # Warm up model with a dummy inference
        dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
        _ = model.predict(dummy_image, verbose=False)
        logger.info("Model warm-up complete")
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

def download_image(image_url: str) -> Image.Image:
    """Download image from URL and return PIL Image"""
    try:
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        image = Image.open(io.BytesIO(response.content))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        return image
    except Exception as e:
        logger.error(f"Failed to download image from {image_url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")

def validate_request(authorization: Optional[str] = Header(None)):
    """Validate request using shared secret"""
    if not SHARED_SECRET:
        # No secret configured, skip validation
        return True
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    # Simple bearer token validation
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization.replace("Bearer ", "")
    if token != SHARED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid authorization token")
    
    return True

@app.post("/infer", response_model=InferenceResponse)
async def run_inference(
    request: InferenceRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Run YOLOv8 inference on an image
    
    Downloads image from URL, runs detection, returns structured results
    """
    # Validate request
    validate_request(authorization)
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if request.phase not in ["before", "after"]:
        raise HTTPException(status_code=400, detail="phase must be 'before' or 'after'")
    
    logger.info(f"Processing inference request: submissionId={request.submissionId}, phase={request.phase}")
    
    try:
        # Download image
        logger.info(f"Downloading image from {request.imageUrl}...")
        image = download_image(request.imageUrl)
        
        # Run inference
        logger.info("Running YOLOv8 inference...")
        # Lower confidence threshold to detect more objects (was 0.25, now 0.15)
        # This helps detect smaller or less obvious waste items
        results = model.predict(image, verbose=False, conf=0.15)  # Confidence threshold
        
        # Parse results
        detected_objects: List[DetectedObject] = []
        
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            
            for i in range(len(boxes)):
                # Get class name
                class_id = int(boxes.cls[i])
                class_name = model.names[class_id] if hasattr(model, 'names') else f"class_{class_id}"
                
                # Get confidence
                confidence = float(boxes.conf[i])
                
                # Get bounding box (xyxy format -> convert to xywh)
                xyxy = boxes.xyxy[i].cpu().numpy()
                x, y, x2, y2 = xyxy
                width = x2 - x
                height = y2 - y
                
                detected_objects.append(DetectedObject(
                    class_name=class_name,
                    confidence=confidence,
                    bbox=[float(x), float(y), float(width), float(height)]
                ))
        
        # Calculate statistics
        object_count = len(detected_objects)
        mean_confidence = (
            sum(obj.confidence for obj in detected_objects) / object_count
            if object_count > 0 else 0.0
        )
        
        logger.info(
            f"Inference complete: {object_count} objects detected, "
            f"mean confidence: {mean_confidence:.3f}"
        )
        
        return InferenceResponse(
            submissionId=request.submissionId,
            phase=request.phase,
            objects=detected_objects,
            objectCount=object_count,
            meanConfidence=mean_confidence,
            modelVersion=MODEL_VERSION
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting GPU Inference Service on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
