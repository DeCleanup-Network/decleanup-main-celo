# ML Verification Architecture

## Stack context

ML scoring is **advisory** for verifier UX; **onchain rewards and Impact Products** still flow through **Submission** + **DCURewardManager** on Celo. **`$cDCU`** mints only via **ClaimVault** (see **`docs/B_CDCU_ONLY_ARCHITECTURE.md`** / **`docs/TOKEN_SPEC.md`**). This document covers the optional **GPU inference** path only.

## Overview

DeCleanup Network uses a two-service architecture for ML verification:

1. **VPS Backend** (existing DeCleanup backend) - Orchestration and storage
2. **GPU Inference Service** (new) - YOLOv8 waste detection

## Architecture Diagram

```
User Submission
    ↓
Frontend (Next.js)
    ↓
VPS Backend API (/api/ml-verification/verify)
    ├─→ Download photos from IPFS
    ├─→ Store photos on VPS filesystem
    ├─→ Call GPU Inference Service
    │   ├─→ POST /infer (before image)
    │   └─→ POST /infer (after image)
    ├─→ Compute verification score
    ├─→ Hash verification result
    └─→ Store hash onchain (Celo)
```

## Service Responsibilities

### VPS Backend

**Location**: `frontend/src/app/api/ml-verification/verify/route.ts`

**Responsibilities:**
- Accept cleanup photo uploads (before/after)
- Download photos from IPFS
- Store photos on VPS filesystem: `/uploads/{submissionId}/before.jpg`
- Call GPU inference service for both images
- Compute verification score from inference results
- Hash verification result
- Store hash onchain via `storeVerificationHash()`

**Must NOT:**
- Run ML inference
- Require GPU

### GPU Inference Service

**Location**: `gpu-inference-service/main.py`

**Responsibilities:**
- Run YOLOv8 fine-tuned on TACO dataset
- Expose REST API: `POST /infer`
- Perform inference only
- Return raw detection results

**Must be:**
- Stateless
- Replaceable
- No onchain contract logic
- No persistent storage

## Verification Scoring

**Formula:**
```typescript
trashDelta = before.objectCount - after.objectCount
normalizedTrashDelta = min(delta / 50, 1.0)  // Max delta = 50
meanConfidence = (before.meanConfidence + after.meanConfidence) / 2

verificationScore = (meanConfidence * 0.5) + (normalizedTrashDelta * 0.5)
```

**Classification:**
- `score >= 0.7` → `AUTO_VERIFIED`
- `0.4 <= score < 0.7` → `NEEDS_REVIEW`
- `score < 0.4` → `REJECTED`

## On-Chain Storage

**Contract**: `Submission.sol`

**Storage:**
```solidity
mapping(uint256 => bytes32) public verificationHash;
```

**Function:**
```solidity
function storeVerificationHash(uint256 submissionId, bytes32 hash) external onlyRole(VERIFIER_ROLE)
```

**What's stored:**
- Only the SHA256 hash of the verification result JSON
- NOT the ML output itself
- Full result stored offchain (VPS filesystem or IPFS)

## Security

1. **Request Validation**: GPU service validates `Authorization: Bearer <SHARED_SECRET>`
2. **Rate Limiting**: Implement in VPS backend (by submissionId)
3. **File Validation**: Photo serving endpoint validates filenames
4. **Role-Based Access**: Only VERIFIER_ROLE can store hashes onchain

## Deployment

### GPU Service

**Requirements:**
- GPU server with CUDA
- Python 3.10+
- YOLOv8 model file (`yolov8-taco.pt`)

**Environment:**
```bash
MODEL_PATH=yolov8-taco.pt
MODEL_VERSION=yolov8-taco-v1
SHARED_SECRET=your_secret_here
HOST=0.0.0.0
PORT=8000
```

**Run:**
```bash
cd gpu-inference-service
pip install -r requirements.txt
python main.py
```

### VPS Backend

**Environment:**
```bash
# Enable ML verification
ML_VERIFICATION_ENABLED=true

# GPU service URL
GPU_INFERENCE_SERVICE_URL=http://your-gpu-server:8000
GPU_SHARED_SECRET=your_secret_here

# Photo storage
UPLOAD_DIR=/var/www/uploads
PUBLIC_URL_BASE=https://your-vps-domain.com
```

## File Structure

```
uploads/
  {submissionId}/
    before.jpg
    after.jpg
```

Served via: `/api/uploads/{submissionId}/before.jpg`

## API Endpoints

### VPS Backend

**POST** `/api/ml-verification/verify`
- Input: `{ submissionId, beforeImageCid, afterImageCid }`
- Output: `{ score, hash, beforeInference, afterInference, imageUrls }`

**GET** `/api/uploads/{submissionId}/{filename}`
- Serves stored photos

### GPU Service

**POST** `/infer`
- Input: `{ submissionId, imageUrl, phase }`
- Output: `{ objects, objectCount, meanConfidence, modelVersion }`

**GET** `/health`
- Health check

## Integration Flow

1. User submits cleanup → Photos uploaded to IPFS
2. Frontend calls `/api/ml-verification/verify`
3. VPS downloads photos from IPFS
4. VPS stores photos on filesystem
5. VPS calls GPU service for before image
6. VPS calls GPU service for after image
7. VPS computes verification score
8. VPS hashes result
9. VPS stores hash onchain (if VERIFIER_ROLE available)
10. Frontend displays result

## Acceptance Criteria

✅ VPS never runs ML
✅ GPU service never touches onchain contracts
✅ Photos stored on VPS
✅ YOLOv8 inference returns structured detections
✅ Verification score is reproducible
✅ Only hashes are written onchain
✅ System is fully auditable

## Troubleshooting

**GPU service not responding:**
- Check GPU service is running
- Verify `GPU_INFERENCE_SERVICE_URL` is correct
- Check network connectivity
- Verify `SHARED_SECRET` matches

**Photos not storing:**
- Check `UPLOAD_DIR` exists and is writable
- Verify disk space
- Check file permissions

**Hash not storing onchain:**
- Verify account has VERIFIER_ROLE
- Check contract address is correct
- Verify network connection
