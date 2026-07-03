#!/usr/bin/env bash
# End-to-end ML dry-run on VPS: verify (IPFS download) → rescore (HEIC→JPEG + GPU).
# Run ON the VPS as root, or from Mac:
#   VPS_SSH=root@207.180.203.243 ./scripts/vps/ml-dry-run.sh ml-dry-run-017
#
set -euo pipefail

SUB="${1:-ml-dry-run-$(date +%s)}"
BASE_URL="${ML_BASE_URL:-http://127.0.0.1:3000}"
BEFORE_CID="${BEFORE_CID:-bafybeiajpplqiv5jzqid7klex2hijwyr5bduhupp6jfws5uud4jumby2f4}"
AFTER_CID="${AFTER_CID:-bafybeiet33dd32hqyfmimjkpsek2cmc3du3xvfxzuxjklmryo2vzhnto6m}"

run_local() {
  echo "==> 1/2 POST /api/ml-verification/verify ($SUB)"
  curl -sf -X POST "${BASE_URL}/api/ml-verification/verify" \
    -H "Content-Type: application/json" \
    -d "{\"submissionId\":\"${SUB}\",\"beforeImageCid\":\"${BEFORE_CID}\",\"afterImageCid\":\"${AFTER_CID}\"}" \
    | tee "/tmp/ml-verify-${SUB}.json"
  echo ""

  echo "==> 2/2 POST /api/ml-verification/rescore ($SUB)"
  curl -sf -X POST "${BASE_URL}/api/ml-verification/rescore" \
    -H "Content-Type: application/json" \
    -d "{\"submissionId\":\"${SUB}\"}" \
    | tee "/tmp/ml-rescore-${SUB}.json"
  echo ""

  echo "==> Result file:"
  UPLOAD_DIR="${UPLOAD_DIR:-/var/www/decleanup/uploads}"
  if [[ -f "${UPLOAD_DIR}/${SUB}/ml_result.json" ]]; then
    cat "${UPLOAD_DIR}/${SUB}/ml_result.json"
  else
    echo "(no ml_result.json at ${UPLOAD_DIR}/${SUB}/)"
  fi
}

if [[ "${RUN_LOCAL:-}" == "1" ]] || [[ "${2:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ -n "${VPS_SSH:-}" ]]; then
  SSH_TARGET="$VPS_SSH"
elif [[ -n "${VPS_HOST:-}" ]]; then
  [[ "$VPS_HOST" == *@* ]] && SSH_TARGET="$VPS_HOST" || SSH_TARGET="root@${VPS_HOST}"
else
  SSH_TARGET="root@207.180.203.243"
fi

echo "Remote dry-run on ${SSH_TARGET} submission=${SUB}"
ssh "$SSH_TARGET" \
  SUB="$SUB" \
  BASE_URL="$BASE_URL" \
  BEFORE_CID="$BEFORE_CID" \
  AFTER_CID="$AFTER_CID" \
  RUN_LOCAL=1 \
  bash -s <<'REMOTE'
set -euo pipefail
SUB="${SUB}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
BEFORE_CID="${BEFORE_CID}"
AFTER_CID="${AFTER_CID}"

echo "==> 1/2 POST /api/ml-verification/verify ($SUB)"
curl -sf -X POST "${BASE_URL}/api/ml-verification/verify" \
  -H "Content-Type: application/json" \
  -d "{\"submissionId\":\"${SUB}\",\"beforeImageCid\":\"${BEFORE_CID}\",\"afterImageCid\":\"${AFTER_CID}\"}"
echo ""

echo "==> 2/2 POST /api/ml-verification/rescore ($SUB)"
curl -sf -X POST "${BASE_URL}/api/ml-verification/rescore" \
  -H "Content-Type: application/json" \
  -d "{\"submissionId\":\"${SUB}\"}"
echo ""

UPLOAD_DIR="${UPLOAD_DIR:-/var/www/decleanup/uploads}"
echo "==> ml_result.json:"
cat "${UPLOAD_DIR}/${SUB}/ml_result.json" 2>/dev/null || echo "(missing)"
REMOTE

echo "Done."
