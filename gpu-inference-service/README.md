# GPU Inference Service

YOLOv8 waste detection inference service for DeCleanup Network.

## Overview

This service runs YOLOv8 fine-tuned on the TACO dataset for waste detection. It's designed to run on a GPU server and is called by the VPS backend.

## Features

- YOLOv8 inference (fine-tuned on TACO dataset)
- REST API for inference requests
- Stateless design (no persistent storage)
- Request validation via shared secret
- Health check endpoint

## Setup

### 1. Install Dependencies

**macOS / Homebrew Python:** use a venv (system `pip` may error with “externally-managed-environment”; system `python3` often has no `uvicorn`).

```bash
cd gpu-inference-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Then run with `python main.py` (after `activate`) or `.venv/bin/python main.py`.

**Other environments:**

```bash
pip install -r requirements.txt
```

### 2. Prepare Model

**Quick Start: Use Default YOLOv8 (Recommended for Testing)**

The service will automatically use the default `yolov8n.pt` model if no custom model is specified. This works immediately with no setup required:

```bash
# No model file needed - service will auto-download yolov8n.pt on first run
# Just start the service:
python main.py
```

**For Production: Use Custom Trained Models**

1. **TACO Dataset Fine-Tuned** (Best for real-world litter detection)
   - Repo: https://github.com/jeremy-rico/litter-detection
   - Train your own model following their instructions
   - Place trained model as `yolov8-taco.pt`

2. **detect-waste** (Non-profit oriented, eco-focused)
   - HuggingFace: https://huggingface.co/Yorai/detect-waste
   - Dataset: https://huggingface.co/datasets/Yorai/detect-waste

3. **waste-detection YOLO** (Simple, effective)
   - HuggingFace: https://huggingface.co/sharktide/waste-detection
   - Download `best.pt` and rename to `yolov8-waste.pt`

4. **TrashNet** (Stanford, for classification)
   - Repo: https://github.com/garythung/trashnet
   - Good for trash type classification

**Model Configuration:**

To use a custom model, set the `MODEL_PATH` environment variable:

```bash
# Use default YOLOv8 (auto-downloads yolov8n.pt)
# No MODEL_PATH needed, or set to empty/default

# Use custom model
export MODEL_PATH=yolov8-taco.pt
export MODEL_VERSION=yolov8-taco-v1
```

**Note:** If `MODEL_PATH` is not set or the file doesn't exist, the service will automatically use `yolov8n.pt` (default YOLOv8 nano model).

### 3. Configure Environment

Create `.env` file:

```bash
# Model configuration
MODEL_PATH=yolov8-taco.pt
MODEL_VERSION=yolov8-taco-v1

# Security
SHARED_SECRET=your_shared_secret_here

# Server configuration
HOST=0.0.0.0
PORT=8000
```

### 4. Run Service

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### POST /infer

Run inference on an image.

**Request:**
```json
{
  "submissionId": "123",
  "imageUrl": "https://example.com/image.jpg",
  "phase": "before"
}
```

**Response:**
```json
{
  "submissionId": "123",
  "phase": "before",
  "objects": [
    {
      "class": "plastic",
      "confidence": 0.82,
      "bbox": [100.5, 150.2, 50.3, 80.1]
    }
  ],
  "objectCount": 7,
  "meanConfidence": 0.84,
  "modelVersion": "yolov8-taco-v1"
}
```

**Headers:**
- `Authorization: Bearer <SHARED_SECRET>` (if SHARED_SECRET is configured)

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "yolov8-taco-v1"
}
```

## Deployment

### Docker (Recommended)

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download default model if custom model not provided
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
docker build -t gpu-inference-service .
docker run -p 8000:8000 \
  -e SHARED_SECRET=your_secret \
  -e MODEL_PATH=yolov8-taco.pt \
  -v $(pwd)/yolov8-taco.pt:/app/yolov8-taco.pt \
  gpu-inference-service
```

### PM2 on a VPS (with Next.js)

1. Copy `best.pt` (or your `MODEL_PATH`) to the server under `gpu-inference-service/` (see `.env.gpu.example`).
2. On the server, create `.env.gpu` with `SHARED_SECRET` matching the frontend `GPU_SHARED_SECRET` (same directory as `ecosystem.config.cjs`).
3. From your laptop, repo root: `VPS_SSH=root@YOUR_VPS_IP ./scripts/vps/deploy-gpu-inference-pm2.sh`  -  or `VPS_HOST=YOUR_VPS_IP` if you use `root`. This rsyncs the service, builds `.venv`, installs deps, and runs `pm2 start` or `pm2 restart decleanup-gpu --update-env`.
4. On the **same** VPS, in `frontend/.env.local`, set `GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000`, then `npm run build` (if needed) and `pm2 restart decleanup --update-env`.

### GPU Server Setup

1. Install CUDA and cuDNN
2. Install Python 3.10+
3. Install dependencies: `pip install -r requirements.txt`
4. Place model file: `yolov8-taco.pt`
5. Run service: `python main.py`

## Security

- Use `SHARED_SECRET` environment variable for request validation
- Configure CORS appropriately for production
- Use HTTPS in production
- Rate limit by submissionId (implement in VPS backend)

## Performance

- Model warm-up on startup (first inference may be slower)
- Batch processing not implemented (one image per request)
- GPU memory: ~2GB for yolov8n, ~4GB for yolov8s

## Monitoring

- Health check endpoint: `/health`
- Logs include inference timing and object counts
- Monitor GPU memory usage
- Track request latency

## Troubleshooting

**Model not loading:**
- Check MODEL_PATH is correct
- Ensure model file exists
- Verify model file is valid YOLOv8 format

**Inference errors:**
- Check image URL is accessible
- Verify image format is supported (JPEG, PNG)
- Check GPU memory availability

**Slow inference:**
- Ensure GPU is being used (check CUDA availability)
- Consider using smaller model (yolov8n vs yolov8s)
- Check GPU memory isn't exhausted
