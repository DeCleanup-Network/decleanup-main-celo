#!/usr/bin/env bash
# When VPS `npm install` times out, build locally and rsync only .next to the server.
# From repo root (after a successful local `cd frontend && npm run build`):
#   VPS_SSH=root@207.180.203.243 ./scripts/vps/rsync-next-build-to-vps.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$ROOT/frontend"

if [[ ! -d "$FRONTEND/.next" ]]; then
  echo "Missing $FRONTEND/.next — run: cd frontend && npm run build"
  exit 1
fi

if [[ -n "${VPS_SSH:-}" ]]; then
  SSH_TARGET="$VPS_SSH"
elif [[ -n "${VPS_HOST:-}" ]]; then
  [[ "$VPS_HOST" == *@* ]] && SSH_TARGET="$VPS_HOST" || SSH_TARGET="root@${VPS_HOST}"
else
  SSH_TARGET="root@207.180.203.243"
fi

REMOTE_FRONTEND="${VPS_FRONTEND:-}"
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

echo "Rsync .next → ${SSH_TARGET}:${REMOTE_FRONTEND}/.next"
rsync -avz --delete "$FRONTEND/.next/" "${SSH_TARGET}:${REMOTE_FRONTEND}/.next/"

echo "Restart PM2..."
ssh "$SSH_TARGET" "cd ${REMOTE_FRONTEND} && pm2 restart decleanup --update-env && pm2 save"
echo "Done. Test: curl -s http://127.0.0.1:3000/api/ml-verification/rescore (on VPS)"
