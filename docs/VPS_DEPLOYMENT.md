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

On VPS, create `gpu-inference-service/.env.gpu`:

```bash
SHARED_SECRET=<same as GPU_SHARED_SECRET on frontend>
MODEL_PATH=yolov8n.pt
MODEL_VERSION=yolov8n-v1
HOST=127.0.0.1
PORT=8000
```

### 4.2 Frontend / ML backend env

On VPS `frontend/.env.local`:

```bash
ML_VERIFICATION_ENABLED=true
GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000
GPU_SHARED_SECRET=<matches inference service>
UPLOAD_DIR=/var/www/decleanup/uploads
PUBLIC_URL_BASE=https://dapp.decleanup.net
```

Then rebuild and restart:

```bash
./scripts/vps/reload-pm2-stacks.sh
```

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
| `scripts/vps/deploy-gpu-inference-pm2.sh` | Deploy GPU service |
| `scripts/vps/reload-pm2-stacks.sh` | Restart PM2 after env/ecosystem changes |
| `scripts/vps/apply-nginx-security-gate.sh` | Rate limits + upload caps |
| `scripts/vps/harden-sshd.sh` | Disable password SSH |
| `scripts/vps/ssh-troubleshoot.sh` | SSH key help |

Security checklist: **`docs/VPS_SECURITY_PROTOCOL.md`**.  
Secrets rotation: **`docs/SECRETS_ROTATION.md`**.
