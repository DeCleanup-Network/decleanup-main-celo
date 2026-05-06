# DMRV (Digital Measurement, Reporting & Verification) Service

Phase-1 AI-assisted image verification for cleanup submissions.

## Overview

The DMRV service analyzes before/after cleanup photos using YOLOv8 waste detection to automatically verify submissions. It:

1. Fetches images from IPFS using the stored CIDs
2. Runs YOLOv8 waste detection on both images
3. Makes a verification decision:
   - **AUTO_APPROVED**: High confidence that cleanup is valid (trash in before, clean in after)
   - **MANUAL_REVIEW**: Low/medium confidence or logic mismatch

## API Endpoint

**POST** `/api/dmrv/verify`

### Request Body

```json
{
  "submissionId": "123",
  "beforeImageCid": "QmXxxx...",
  "afterImageCid": "QmYyyy...",
  "gps": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "timestamp": 1234567890
}
```

### Response

```json
{
  "decision": "AUTO_APPROVED",
  "confidence": 0.92,
  "modelHash": "abc123def456",
  "resultHash": "789ghi012jkl",
  "analysis": {
    "before": {
      "hasWaste": true,
      "wasteCount": 3,
      "detections": [...],
      "overallConfidence": 0.85
    },
    "after": {
      "hasWaste": false,
      "wasteCount": 0,
      "detections": [],
      "overallConfidence": 0.90
    },
    "reasoning": "Cleanup verified: Before image shows 3 waste items..."
  },
  "timestamp": 1234567890
}
```

## Configuration

Environment variables (`.env.local`):

```bash
# Enable/disable DMRV service
DMRV_ENABLED=true

# Allow auto-approval (if false, always returns MANUAL_REVIEW)
DMRV_ALLOW_AUTO_APPROVE=true

# Confidence thresholds (0-1 scale)
DMRV_AUTO_APPROVE_THRESHOLD=0.85  # Minimum confidence for auto-approval
DMRV_MANUAL_REVIEW_THRESHOLD=0.60  # Below this = always manual review

# Model provider: 'mock' | 'huggingface' | 'local'
DMRV_MODEL_PROVIDER=mock

# Model name (for HuggingFace)
# Recommended models:
# - FathomNet/trash-detector (object detection, best for waste detection)
# - prithivMLmods/Trash-Net (image classification)
# - rootstrap-org/waste-classifier (image classification)
DMRV_MODEL_NAME=FathomNet/trash-detector

# HuggingFace API key (get from https://huggingface.co/settings/tokens)
# Also accepts HF_TOKEN environment variable
HUGGINGFACE_API_KEY=your_token_here

# IPFS gateway (defaults to Pinata)
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

## Tuning Thresholds

### Auto-Approve Threshold (`DMRV_AUTO_APPROVE_THRESHOLD`)

- **Higher (0.90-0.95)**: More conservative, fewer false positives
- **Lower (0.75-0.80)**: More lenient, more auto-approvals
- **Default (0.85)**: Balanced approach

### Manual Review Threshold (`DMRV_MANUAL_REVIEW_THRESHOLD`)

- **Higher (0.70)**: More submissions go to manual review
- **Lower (0.50)**: More submissions attempt auto-approval
- **Default (0.60)**: Conservative fallback

## Verification Logic

The service uses a weighted confidence calculation:

1. **Before Image Analysis** (40% weight)
   - Should detect waste (trash items)
   - High confidence = good

2. **After Image Analysis** (40% weight)
   - Should detect no/minimal waste (clean state)
   - High confidence = good

3. **Logic Match** (20% weight)
   - Before has waste AND after is clean = 1.0
   - Otherwise = 0.0

**Decision Rules:**
- `confidence >= autoApproveThreshold` AND logic matches → `AUTO_APPROVED`
- `confidence < manualReviewThreshold` → `MANUAL_REVIEW`
- Between thresholds → depends on `allowAutoApprove` flag

## Model Providers

### Mock (Default)

- Simulated detection results
- Fast, no API costs
- Good for testing/development

### HuggingFace

- Uses HuggingFace Inference API
- Requires `HUGGINGFACE_API_KEY` or `HF_TOKEN`
- Real trash detection models
- Recommended models:
  - **FathomNet/trash-detector** (object detection) - Best for waste detection
  - **prithivMLmods/Trash-Net** (image classification)
  - **rootstrap-org/waste-classifier** (image classification)

**Setup:**
1. Create Hugging Face account at https://huggingface.co/join
2. Generate token at https://huggingface.co/settings/tokens/new
   - Select permission: "Make calls to Inference Providers"
   - Token type: Fine-grained (recommended)
3. Set environment variables:
   ```bash
   DMRV_MODEL_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=your_token_here
   DMRV_MODEL_NAME=FathomNet/trash-detector
   ```

**Free Tier:**
- Hugging Face offers a generous free tier for Inference Providers
- PRO users get additional credits
- First request may take a few seconds (model loading)

### Local (TODO)

- Run YOLOv8 locally via ultralytics
- Docker container option
- No API costs, full control

## Disabling AI Verification

To disable DMRV entirely:

```bash
DMRV_ENABLED=false
```

Or set `allowAutoApprove=false` to keep analysis but always return `MANUAL_REVIEW`:

```bash
DMRV_ALLOW_AUTO_APPROVE=false
```

## Integration Example

```typescript
import { verifyCleanup } from '@/lib/dmrv/verification'

// After submission is created
const result = await verifyCleanup({
  submissionId: cleanupId.toString(),
  beforeImageCid: beforeHash,
  afterImageCid: afterHash,
  gps: { latitude: lat, longitude: lng },
  timestamp: Date.now(),
})

if (result.decision === 'AUTO_APPROVED' && result.confidence >= 0.85) {
  // Auto-approve submission
  await verifyCleanup(cleanupId)
} else {
  // Route to manual verification
  // (existing flow continues)
}
```

## Audit Trail

Each verification includes:
- **modelHash**: Hash of model version/weights (for reproducibility)
- **resultHash**: Hash of verification result (for audit)

These hashes allow:
- Verifying which model version was used
- Auditing verification decisions
- Detecting model drift over time

## Phase 2 TODO

- [ ] Local YOLOv8 implementation (ultralytics)
- [ ] Custom waste detection model training
- [ ] Batch processing for multiple submissions
- [ ] Confidence calibration based on historical data
- [ ] A/B testing different thresholds
- [ ] Metrics dashboard (auto-approval rate, confidence distribution)

## Troubleshooting

**Images not fetching from IPFS:**
- Check `NEXT_PUBLIC_IPFS_GATEWAY` is correct
- Verify CIDs are valid
- Check IPFS gateway is accessible

**HuggingFace API errors:**
- Verify `HUGGINGFACE_API_KEY` is set
- Check API rate limits
- Ensure model name is correct

**Low confidence scores:**
- Adjust thresholds (see Tuning section)
- Check image quality (resolution, lighting)
- Consider model fine-tuning for your use case
