#!/usr/bin/env bash
# Sync gpu-inference-service to the VPS and (re)start it under PM2.
# Run from repo root:
#   VPS_SSH=root@your.vps.ip ./scripts/vps/deploy-gpu-inference-pm2.sh
# Or host only (implies root@):
#   VPS_HOST=your.vps.ip ./scripts/vps/deploy-gpu-inference-pm2.sh
#
# Before first run on the server:
#   - Copy best.pt into the remote gpu-inference-service directory (or set MODEL_PATH in .env.gpu).
#   - Create .env.gpu with SHARED_SECRET=<same as GPU_SHARED_SECRET on Next>.
#
set -euo pipefail

REMOTE_BASE="${VPS_DECLEANUP:-/var/www/decleanup}"
REMOTE_GPU="${VPS_GPU_DIR:-${REMOTE_BASE}/gpu-inference-service}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# SSH target: VPS_SSH wins; else VPS_HOST may be "ip" or "user@ip"
if [[ -n "${VPS_SSH:-}" ]]; then
  SSH_TARGET="$VPS_SSH"
elif [[ -n "${VPS_HOST:-}" ]]; then
  if [[ "$VPS_HOST" == *@* ]]; then
    SSH_TARGET="$VPS_HOST"
  else
    SSH_TARGET="root@${VPS_HOST}"
  fi
else
  SSH_TARGET="root@207.180.203.243"
fi

echo "Local:  $ROOT/gpu-inference-service/"
echo "Remote: ${SSH_TARGET}:${REMOTE_GPU}/"
echo "Rsync (excludes .venv, __pycache__)..."
rsync -avz \
  --exclude .venv \
  --exclude __pycache__ \
  --exclude .git \
  "$ROOT/gpu-inference-service/" \
  "${SSH_TARGET}:${REMOTE_GPU}/"

echo "Remote: venv, deps, PM2..."
ssh "$SSH_TARGET" "bash -s" <<EOF
set -euo pipefail
cd "${REMOTE_GPU}"
if [[ ! -f best.pt ]]; then
  echo "Note: best.pt not found in ${REMOTE_GPU}. Upload with: scp best.pt ${SSH_TARGET}:${REMOTE_GPU}/"
fi
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -U pip
.venv/bin/pip install -q -r requirements.txt
if pm2 describe decleanup-gpu >/dev/null 2>&1; then
  pm2 restart decleanup-gpu --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
EOF

echo "Done. Set frontend GPU_INFERENCE_SERVICE_URL (e.g. http://127.0.0.1:8000) and pm2 restart decleanup --update-env"
