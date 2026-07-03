#!/usr/bin/env bash
# Deploy ML verification fixes (sharp HEIC→JPEG, /rescore) to VPS and rebuild Next.js.
# From repo root:
#   VPS_SSH=root@207.180.203.243 ./scripts/vps/deploy-ml-verification-to-vps.sh
#
# Optional: VPS_FRONTEND=/var/www/decleanup/frontend/frontend if nested layout on VPS.
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ -n "${VPS_SSH:-}" ]]; then
  SSH_TARGET="$VPS_SSH"
elif [[ -n "${VPS_HOST:-}" ]]; then
  [[ "$VPS_HOST" == *@* ]] && SSH_TARGET="$VPS_HOST" || SSH_TARGET="root@${VPS_HOST}"
else
  SSH_TARGET="root@207.180.203.243"
fi

REMOTE_BASE="${VPS_DECLEANUP:-/var/www/decleanup}"
REMOTE_FRONTEND="${VPS_FRONTEND:-}"

echo "==> Detecting Next.js app directory on ${SSH_TARGET}..."
if [[ -z "$REMOTE_FRONTEND" ]]; then
  REMOTE_FRONTEND="$(ssh "$SSH_TARGET" bash -s <<'DETECT'
set -euo pipefail
for d in /var/www/decleanup/frontend/frontend /var/www/decleanup/frontend; do
  if [[ -f "$d/package.json" ]] && grep -q '"build"' "$d/package.json" 2>/dev/null; then
    echo "$d"
    exit 0
  fi
done
echo /var/www/decleanup/frontend
DETECT
)"
fi

echo "Remote frontend: ${SSH_TARGET}:${REMOTE_FRONTEND}"

echo "==> Rsync frontend source..."
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude uploads \
  --exclude var \
  "$ROOT/frontend/" \
  "${SSH_TARGET}:${REMOTE_FRONTEND}/"

echo "==> Install libheif (sharp HEIC support), build, restart PM2..."
ssh "$SSH_TARGET" "REMOTE_FRONTEND=${REMOTE_FRONTEND} REMOTE_BASE=${REMOTE_BASE} bash -s" <<'REMOTE'
set -euo pipefail
FRONTEND="${REMOTE_FRONTEND}"
BASE="${REMOTE_BASE}"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq libheif1 libheif-examples libheif-plugin-libde265 libheif-plugin-x265 2>/dev/null || true
fi

cd "$FRONTEND"
echo "Building in $(pwd)..."
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
for attempt in 1 2 3; do
  if npm install; then
    break
  fi
  if [[ "$attempt" -eq 3 ]]; then
    echo "npm install failed after 3 attempts. Build locally and run: ./scripts/vps/rsync-next-build-to-vps.sh"
    exit 1
  fi
  echo "npm install attempt $attempt failed; retrying in 15s..."
  sleep 15
done
npm run build

if pm2 describe decleanup >/dev/null 2>&1; then
  pm2 restart decleanup --update-env
else
  if [[ -f ecosystem.config.js ]]; then
    pm2 start ecosystem.config.js
  else
    pm2 start npm --name decleanup -- start
  fi
fi
pm2 save

echo ""
echo "==> GPU health:"
curl -sf http://127.0.0.1:8000/health || echo "(GPU not reachable on :8000)"
echo ""
echo "==> ML verify GET:"
curl -sf http://127.0.0.1:3000/api/ml-verification/verify || true
echo ""
echo "==> ML rescore GET:"
curl -sf http://127.0.0.1:3000/api/ml-verification/rescore || true
echo ""
pm2 status
REMOTE

echo ""
echo "Deploy complete. Test:"
echo "  ./scripts/vps/ml-dry-run.sh ml-dry-run-$(date +%s)"
