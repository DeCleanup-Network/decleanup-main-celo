#!/usr/bin/env bash
# Deploy local frontend/ to the VPS when /var/www/decleanup/frontend is NOT a git repo.
# Run from repo root: ./scripts/vps/rsync-frontend-to-vps.sh
# Optional: VPS_SSH=root@ip  or  VPS_HOST=ip  (same as deploy-gpu-inference-pm2.sh)
#
# Prereq: local branch checked out with the code you want live (e.g. AI-verification + main merged).
#
set -euo pipefail
REMOTE_DIR="${VPS_FRONTEND:-/var/www/decleanup/frontend}"
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

echo "Local:  $ROOT/frontend/"
echo "Remote: ${SSH_TARGET}:${REMOTE_DIR}/"
echo "Rsync (excludes node_modules, .next, .git)..."
rsync -avz \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  "$ROOT/frontend/" \
  "${SSH_TARGET}:${REMOTE_DIR}/"

echo "Install, build, pm2..."
ssh "$SSH_TARGET" "cd ${REMOTE_DIR} && npm install && npm run build && pm2 restart decleanup --update-env"
# .npmrc in frontend/ sets legacy-peer-deps=true so install matches local/Vercel.
echo "Done."
