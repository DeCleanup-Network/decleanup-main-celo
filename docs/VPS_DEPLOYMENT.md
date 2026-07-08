# VPS deployment (Next.js + optional ML)

Production today: **Vercel** hosts `https://dapp.decleanup.net`. The **VPS** (`207.180.203.243`) runs the same Next.js app under PM2 when you need local disk (`UPLOAD_DIR`), GPU inference, or a dedicated ML host.

| Host | Role |
|------|------|
| **Vercel** | Public dapp, Supabase APIs, impact feed sync |
| **VPS** | Full stack clone + PM2 (`decleanup`), optional GPU worker (`decleanup-gpu`) |
| **ml.decleanup.net** (optional) | ML-only backend; Vercel proxies via `ML_BACKEND_ORIGIN` |

Onchain network: **Celo mainnet (42220)**. Addresses: `contracts/scripts/deployed_addresses.json`.

---

## 1. Prerequisites

- SSH access to VPS (see `scripts/vps/ssh-troubleshoot.sh`)
- Node 20+, PM2, Nginx, certbot
- `frontend/.env.local` on VPS (copy from Vercel Production; never commit secrets)
- Supabase migrations applied (`frontend/supabase/migrations/`)

---

## 2. Deploy frontend to VPS

From repo root on your Mac:

```bash
VPS_SSH=deploy@207.180.203.243 ./scripts/vps/rsync-frontend-to-vps.sh
```

This rsyncs `frontend/` (excludes `node_modules`, `.next`), runs `npm install`, `npm run build`, and `pm2 restart decleanup --update-env`.

Paths on VPS:

| Path | Purpose |
|------|---------|
| `/var/www/decleanup/frontend` | Next.js app |
| `/var/www/decleanup/gpu-inference-service` | GPU worker (optional) |

After env changes: `./scripts/vps/reload-pm2-stacks.sh`

---

## 3. Nginx + TLS + hardening

Follow **`docs/VPS_SECURITY_PROTOCOL.md`**. Quick apply:

```bash
sudo bash /var/www/decleanup/DCUCELOMVP/scripts/vps/apply-nginx-security-gate.sh
sudo bash /var/www/decleanup/DCUCELOMVP/scripts/vps/harden-sshd.sh   # after key login works
```

App must listen on **127.0.0.1:3000** only; Nginx terminates TLS on 443.

---

## 4. Enable ML verification

ML is **off by default**. Set on the host that runs `POST /api/ml-verification/verify` (VPS or ml subdomain).

### 4.1 GPU inference service

```bash
VPS_SSH=deploy@207.180.203.243 ./scripts/vps/deploy-gpu-inference-pm2.sh
```

**Install TACO litter weights** (recommended — replaces default `yolov8n.pt`):

```bash
VPS_SSH=deploy@207.180.203.243 ./scripts/vps/install-taco-model.sh
# Heavier / more accurate: TACO_VARIANT=m ./scripts/vps/install-taco-model.sh
```

Weights source: [jeremy-rico/litter-detection](https://github.com/jeremy-rico/litter-detection) (`runs/detect/train/yolov8n_100epochs/weights/best.pt`).

On VPS, create `gpu-inference-service/.env.gpu` (or let the install script write it):

```bash
SHARED_SECRET=<same as GPU_SHARED_SECRET on frontend>
MODEL_PATH=yolov8-taco.pt
MODEL_VERSION=yolov8-taco-n-100epochs-v1
HOST=127.0.0.1
PORT=8000
# Detection tuning (defaults shown); passed to the process via ecosystem.config.cjs
INFER_CONF=0.10
INFER_IMGSZ=1280
```

**Updating the GPU service on the VPS.** The service runs from `/var/www/decleanup/gpu-inference-service` (a copy, not the git checkout). After pulling new code:

```bash
rsync -av --exclude=.env.gpu --exclude='*.pt' --exclude=.venv --exclude=venv --exclude=__pycache__ \
  /var/www/decleanup/frontend/gpu-inference-service/ /var/www/decleanup/gpu-inference-service/
chown -R deploy:deploy /var/www/decleanup/gpu-inference-service
# as deploy:
.venv/bin/pip install -r requirements.txt
pm2 delete decleanup-gpu && pm2 start ecosystem.config.cjs && pm2 save
```

Plain `pm2 restart` does not reload `ecosystem.config.cjs`/`.env.gpu` — always delete + start after env or config changes.

**Boot persistence.** PM2 process lists are per Linux user: `decleanup` (Next.js) runs under `root`, `decleanup-gpu` under `deploy`. Each needs its own systemd resurrect unit; for deploy run as root once: `pm2 startup systemd -u deploy --hp /home/deploy`, then `pm2 save` as deploy.

**Warning (removed 2026-07-07):** a legacy root systemd unit `gpu-inference.service` (Restart=always, empty `MODEL_PATH`, its own secret) used to race PM2 for port 8000 and serve `yolov8n-default` — this was the historical "orphan process on 8000". It is disabled and archived in `/var/www/decleanup/artifacts/cleanup-20260707/`; do not re-enable it.

### 4.2 Frontend / ML backend env

On VPS `frontend/.env.local`:

```bash
ML_VERIFICATION_ENABLED=true
GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000
GPU_SHARED_SECRET=<matches inference service>
UPLOAD_DIR=/var/www/decleanup/uploads
# Public origin of this ML host — stored in ml_result.json imageUrls, so it must be
# reachable off-server. The GPU service reads photos via localPath, not this URL.
PUBLIC_URL_BASE=https://ml.decleanup.net
```

Note: PM2 injects env captured when the app was first registered, and those values win over `.env.local`. To change a value like `PUBLIC_URL_BASE`, run `PUBLIC_URL_BASE=... pm2 restart decleanup --update-env && pm2 save`.

Then rebuild and restart:

```bash
./scripts/vps/deploy-ml-verification-to-vps.sh
# or: ./scripts/vps/reload-pm2-stacks.sh
```

### 4.2.1 iPhone HEIC photos + rescore

Mobile uploads are often **HEIC** on IPFS. The verify route normalizes to JPEG via **sharp** (requires `libheif` on the VPS).

If verify ran before deploy, or photos were saved as HEIC with a `.jpg` name, **re-score without re-downloading IPFS**:

```bash
curl -X POST "http://127.0.0.1:3000/api/ml-verification/rescore" \
  -H "Content-Type: application/json" \
  -d '{"submissionId":"ml-dry-run-015"}'
```

Full dry-run (verify → rescore):

```bash
./scripts/vps/ml-dry-run.sh ml-dry-run-017
```

**Do not** call `/verify` twice on the same submission ID — it re-fetches IPFS and overwrites stored photos.

### 4.3 Vercel UI + VPS ML (split deploy)

Keep the dapp on Vercel; run ML on VPS or `ml.decleanup.net`:

**Vercel env:**

```bash
ML_VERIFICATION_ENABLED=true
ML_BACKEND_ORIGIN=https://ml.decleanup.net
ML_PROXY_SHARED_SECRET=<shared secret>
```

**ML host env:**

```bash
ML_VERIFICATION_ENABLED=true
ML_PROXY_SHARED_SECRET=<same as Vercel>
# ... GPU_* and UPLOAD_DIR as above
```

Browser calls only `dapp.decleanup.net`; Vercel forwards to the ML host server-to-server.

Details: **`docs/ML_VERIFICATION_ARCHITECTURE.md`**.

---

## 5. Impact feed (landing page API)

After verified cleanups on mainnet:

```bash
curl -X POST "https://dapp.decleanup.net/api/impact/sync" \
  -H "x-impact-sync-secret: YOUR_SECRET"
```

Requires `IMPACT_SYNC_SECRET`, Supabase, and `NEXT_PUBLIC_SUBMISSION_CONTRACT` baked into the **Vercel build**. See **`docs/PUBLIC_IMPACT_API.md`**.

---

## 6. Health checks

```bash
curl -sS http://127.0.0.1:3000/api/health/sharp
curl -sS http://127.0.0.1:8000/health
pm2 status
./scripts/vps/local-threshold-check.sh
```

---

## 7. Scripts index

| Script | Purpose |
|--------|---------|
| `scripts/vps/rsync-frontend-to-vps.sh` | Deploy frontend |
| `scripts/vps/deploy-ml-verification-to-vps.sh` | Deploy ML routes + libheif + rebuild |
| `scripts/vps/ml-dry-run.sh` | Verify + rescore dry-run on VPS |
| `scripts/vps/deploy-gpu-inference-pm2.sh` | Deploy GPU service |
| `scripts/vps/install-taco-model.sh` | Download TACO weights + restart `decleanup-gpu` |
| `scripts/vps/reload-pm2-stacks.sh` | Restart PM2 after env/ecosystem changes |
| `scripts/vps/apply-nginx-security-gate.sh` | Rate limits + upload caps |
| `scripts/vps/harden-sshd.sh` | Disable password SSH |
| `scripts/vps/ssh-troubleshoot.sh` | SSH key help |

Security checklist: **`docs/VPS_SECURITY_PROTOCOL.md`**.  
Secrets rotation: **`docs/SECRETS_ROTATION.md`**.
