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

**Client resilience:** the cleanup success screen sends `POST /verify` with a 150s abort timeout; if that call fails, times out, or returns without a score, it polls `GET /result?cleanupId=` every 12s for up to ~4.5 min (the ML host keeps processing and writes `ml_result.json` even when the original request was dropped, e.g. by the serverless proxy window).

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
# Detection tuning (passed through ecosystem.config.cjs; defaults shown):
INFER_CONF=0.10
INFER_IMGSZ=1280
# Optional SAHI tiled inference (see Scoring & detection notes below):
INFER_TILED=false
INFER_TILE=768
INFER_TILE_OVERLAP=0.2
INFER_TILE_MAXDIM=2400
```

`ecosystem.config.cjs` only injects the env keys it lists — after changing `.env.gpu`, use `pm2 delete decleanup-gpu && pm2 start ecosystem.config.cjs && pm2 save` (plain `restart` keeps the old env).

The Next.js host also reads scoring thresholds from its `.env.local`:

```bash
ML_VERIFICATION_AUTO_THRESHOLD=0.35   # score ≥ this → approved
ML_VERIFICATION_REVIEW_THRESHOLD=0.15 # score ≥ this → pending; below with no reduction → rejected
```

---

## Scoring

The score is the **fraction of detected "before" litter that is gone in "after"**:
`score = (beforeCount - afterCount) / beforeCount`, clamped to 0..1. It compares the same
detector against itself on the two photos, so it stays meaningful even when the model
under-counts a busy field. It deliberately does **not** fold in the detector's absolute
confidence (litter models sit at ~0.1–0.2, which would cap every real cleanup below approval).

| Condition | Verdict |
|-----------|---------|
| `beforeCount === 0` | pending (nothing to judge) |
| `score ≥ AUTO_THRESHOLD` (0.35) | approved |
| `score ≥ REVIEW_THRESHOLD` (0.15) | pending |
| below, litter unchanged/removed | pending |
| below, litter increased (`delta < 0`) | rejected |

`computeVerificationScore` in `frontend/src/lib/dmrv/gpu-verification.ts`. Human verifiers
still make the final onchain decision.

### Detection & resolution (why not just "detect everything")

Litter models miss small/distant objects. Two levers:

- **Input resolution is the ceiling.** The client compresses uploads to ≤2048px
  (`compress-image-for-upload.ts`), and forwarded/messaging copies can be ~1280px. At that
  size distant litter is a few pixels and is physically unresolvable — the reduction-ratio
  score is the pragmatic answer (a real cleanup passes regardless of absolute count).
- **SAHI tiled inference** (`INFER_TILED=true`) slices the image into overlapping tiles and
  merges detections. It only helps on genuinely high-resolution photos; on ~1280px inputs it
  found *fewer* objects in testing, so it ships **off by default**. Enable it only after
  confirming the pipeline ingests full-resolution images, and re-test before/after counts.

---

## API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ml-verification/verify` | POST | Run pipeline; body `{ submissionId, beforeImageCid, afterImageCid }` |
| `/api/ml-verification/result` | GET | Read cached result for verifier UI |
| `/api/uploads/{submissionId}/{filename}` | GET | Serve stored photos |
| GPU `/infer` | POST | YOLOv8 detections (internal) |
| GPU `/health` | GET | Liveness |

The legacy `/api/dmrv/verify` route and its mock HuggingFace pipeline were removed; all code uses **`/api/ml-verification/verify`**.

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
| `objectCount: 0` everywhere | Deployed `gpu-inference-service/main.py` older than repo (sync + `pip install -r requirements.txt`, then delete+start PM2); old code ran 640px inference |
| `/health` shows `yolov8n-default` or port 8000 "stolen" after restarts | A legacy root systemd unit `gpu-inference.service` used to race PM2 for the port (removed 2026-07-07, unit file archived in `/var/www/decleanup/artifacts/`). It must stay disabled — PM2 under user `deploy` owns the GPU service |
| Next.js ignores changed `.env.local` value | PM2 injects env captured at app creation and it wins over `.env.local`; run `VAR=value pm2 restart decleanup --update-env && pm2 save` |
