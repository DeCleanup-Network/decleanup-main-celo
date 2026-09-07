#!/usr/bin/env bash
# Pull ML-related env vars from VPS into 04-SECRETS.env (run from your Mac).
# Requires SSH access to root@VPS.
#
#   VPS_SSH=root@207.180.203.243 ./scripts/populate-ml-handoff-secrets.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/handoff/ml-verification-dev-pack/04-SECRETS.env"
TEMPLATE="$ROOT/handoff/ml-verification-dev-pack/04-SECRETS.env.template"

SSH_TARGET="${VPS_SSH:-root@207.180.203.243}"
FRONTEND="${VPS_FRONTEND_DIR:-/var/www/decleanup/frontend/frontend}"
GPU_DIR="${VPS_GPU_DIR:-/var/www/decleanup/gpu-inference-service}"

cp "$TEMPLATE" "$OUT"

pull_var() {
  local key="$1" file="$2"
  local val
  val="$(ssh "$SSH_TARGET" "grep -E '^${key}=' '${file}' 2>/dev/null | head -1 | cut -d= -f2-" || true)"
  if [[ -n "$val" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$OUT"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$OUT"
    fi
  fi
}

echo "Pulling from $SSH_TARGET ..."

for key in ML_VERIFICATION_ENABLED ML_PROXY_SHARED_SECRET GPU_INFERENCE_SERVICE_URL \
  GPU_INFERENCE_PATH GPU_SHARED_SECRET UPLOAD_DIR PUBLIC_URL_BASE PINATA_JWT ML_BACKEND_ORIGIN; do
  pull_var "$key" "${FRONTEND}/.env.local"
done

for key in MODEL_PATH MODEL_VERSION HOST PORT SHARED_SECRET INFER_CONF INFER_IMGSZ; do
  pull_var "$key" "${GPU_DIR}/.env.gpu"
done

chmod 600 "$OUT"
echo "Wrote $OUT"
echo "Review before archiving. Add SSH password note for dev if needed."
