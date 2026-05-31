# ML verification architecture

ML scoring is **advisory** for verifier UX. **Onchain rewards and Impact Products** still flow through **Submission** + **DCURewardManager**. **`$cDCU`** mints only via **ClaimVault** (`docs/B_CDCU_ONLY_ARCHITECTURE.md`).

**Deploy:** `docs/VPS_DEPLOYMENT.md` · **Security:** `docs/VPS_SECURITY_PROTOCOL.md`

---

## Flow

```
Cleanup submit (photos → IPFS)
    ↓
POST /api/ml-verification/verify  (VPS or ml host; optional on Vercel via proxy)
    ├─ Fetch before/after from IPFS
    ├─ Store under UPLOAD_DIR/{submissionId}/
    ├─ POST gpu-inference-service /infer (before + after)
    ├─ Score + write ml_result.json
    └─ (Optional) verifier stores hash onchain via Submission.storeVerificationHash
    ↓
GET /api/ml-verification/result?cleanupId=…  (verifier UI)
```

Human verifiers always approve/reject onchain. ML does not auto-approve submissions.

---

## Enable

Set **`ML_VERIFICATION_ENABLED=true`** on the host that runs the verify route.

| Mode | Where | Key env |
|------|-------|---------|
| All-in-one VPS | Same PM2 as Next.js | `GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000` |
| Vercel + ML host | Vercel proxies to VPS | `ML_BACKEND_ORIGIN` + `ML_PROXY_SHARED_SECRET` |

GPU service: `gpu-inference-service/` · deploy script: `scripts/vps/deploy-gpu-inference-pm2.sh`

---

## Env (ML host)

```bash
ML_VERIFICATION_ENABLED=true
GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000
GPU_SHARED_SECRET=<shared with inference service>
UPLOAD_DIR=/var/www/decleanup/uploads
PUBLIC_URL_BASE=https://dapp.decleanup.net
```

Inference service (`.env.gpu`):

```bash
SHARED_SECRET=<same as GPU_SHARED_SECRET>
HOST=127.0.0.1
PORT=8000
```

---

## API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ml-verification/verify` | POST | Run pipeline; body `{ submissionId, beforeImageCid, afterImageCid }` |
| `/api/ml-verification/result` | GET | Read cached result for verifier UI |
| `/api/uploads/{submissionId}/{filename}` | GET | Serve stored photos |
| GPU `/infer` | POST | YOLOv8 detections (internal) |
| GPU `/health` | GET | Liveness |

Legacy route **`/api/dmrv/verify`** remains for older integrations; new code uses **`/api/ml-verification/verify`**.

---

## Onchain storage (optional)

`Submission.storeVerificationHash(submissionId, hash)` — **VERIFIER_ROLE** only. Stores SHA256 of result JSON, not raw ML output.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| ML skipped | `ML_VERIFICATION_ENABLED` exactly `true` |
| GPU timeout | `pm2 logs decleanup-gpu`; `curl localhost:8000/health` |
| No result in verifier UI | Same deployment wrote `UPLOAD_DIR`; or proxy secret mismatch |
| 401 on ml host | `ML_PROXY_SHARED_SECRET` / `x-ml-proxy-secret` |
