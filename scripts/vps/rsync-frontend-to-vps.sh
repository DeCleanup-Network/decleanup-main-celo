#!/usr/bin/env bash
# Deploy local frontend/ to the VPS when /var/www/decleanup/frontend is NOT a git repo.
# Run from repo root: ./scripts/vps/rsync-frontend-to-vps.sh
# Optional: VPS_SSH=root@ip  or  VPS_HOST=ip  (same as deploy-gpu-inference-pm2.sh)
#
# Prereq: checkout the branch you want live (e.g. main).
#
set -euo pipefail
REMOTE_DIR="${VPS_FRONTEND:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

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

if [[ -z "$REMOTE_DIR" ]]; then
  echo "Detecting Next.js app directory on ${SSH_TARGET}..."
  REMOTE_DIR="$(ssh "$SSH_TARGET" bash -s <<'DETECT'
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

echo "Local:  $ROOT/frontend/"
echo "Remote: ${SSH_TARGET}:${REMOTE_DIR}/"
echo "Rsync (excludes node_modules, .next, .git)..."
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude uploads \
  --exclude var \
  "$ROOT/frontend/" \
  "${SSH_TARGET}:${REMOTE_DIR}/"

echo "Install, build, pm2..."
ssh "$SSH_TARGET" "cd ${REMOTE_DIR} && npm install && npm run build && pm2 restart decleanup --update-env"
# .npmrc in frontend/ sets legacy-peer-deps=true so install matches local/Vercel.
echo "Done."
