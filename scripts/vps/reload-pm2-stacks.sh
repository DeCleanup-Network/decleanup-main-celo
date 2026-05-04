#!/usr/bin/env bash
# Apply updated PM2 ecosystem settings (memory limits, restart_delay, etc.) on the VPS.
# docs/VPS_SECURITY_PROTOCOL.md §6.1 — run this after pulling new ecosystem.config.* files.
#
# The agent cannot SSH to your VPS from here; use this one command from your machine.
#
# From your Mac, repo root:
#   VPS_SSH=deploy@your.vps.ip ./scripts/vps/reload-pm2-stacks.sh
#   VPS_HOST=your.vps.ip ./scripts/vps/reload-pm2-stacks.sh
#
# Already SSH'd into the VPS:
#   ./scripts/vps/reload-pm2-stacks.sh --local
#
set -euo pipefail

REMOTE_BASE="${VPS_DECLEANUP:-/var/www/decleanup}"
REMOTE_GPU="${VPS_GPU_DIR:-${REMOTE_BASE}/gpu-inference-service}"
REMOTE_FRONTEND="${VPS_FRONTEND:-${REMOTE_BASE}/frontend}"

reload_stacks() {
  reload_one() {
    local name="$1"
    local dir="$2"
    if pm2 describe "$name" >/dev/null 2>&1; then
      echo "→ pm2 restart ${name} --update-env (cwd ${dir})"
      (cd "$dir" && pm2 restart "$name" --update-env)
    else
      echo "→ skip (not in PM2): ${name}"
    fi
  }
  reload_one decleanup "$REMOTE_FRONTEND"
  reload_one decleanup-gpu "$REMOTE_GPU"
  pm2 save
  echo ""
  pm2 status
}

if [[ "${1:-}" == "--local" ]] || [[ "${RUN_LOCAL:-}" == "1" ]]; then
  reload_stacks
  exit 0
fi

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

echo "Remote: ${SSH_TARGET}"
echo "REMOTE_BASE=${REMOTE_BASE}"
ssh "$SSH_TARGET" \
  REMOTE_BASE="$REMOTE_BASE" \
  REMOTE_GPU="$REMOTE_GPU" \
  REMOTE_FRONTEND="$REMOTE_FRONTEND" \
  bash -s <<'REMOTE'
set -euo pipefail
reload_one() {
  local name="$1"
  local dir="$2"
  if pm2 describe "$name" >/dev/null 2>&1; then
    echo "→ pm2 restart ${name} --update-env (cwd ${dir})"
    (cd "$dir" && pm2 restart "$name" --update-env)
  else
    echo "→ skip (not in PM2): ${name}"
  fi
}
reload_one decleanup "${REMOTE_FRONTEND}"
reload_one decleanup-gpu "${REMOTE_GPU}"
pm2 save
echo ""
pm2 status
REMOTE

echo "Done."
