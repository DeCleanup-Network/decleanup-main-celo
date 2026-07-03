#!/usr/bin/env bash
# Download TACO-trained YOLO weights (jeremy-rico/litter-detection) and wire PM2 GPU service.
#
# From your Mac (repo root):
#   VPS_SSH=deploy@207.180.203.243 ./scripts/vps/install-taco-model.sh
#
# If gpu dir is root-owned (common), USE_SUDO=1 is the default for remote runs.
#
# Upload model from laptop → /tmp on VPS (when VPS curl fails):
#   VPS_SSH=deploy@207.180.203.243 ./scripts/vps/install-taco-model.sh --from-local
#
# On VPS directly:
#   USE_SUDO=1 ./scripts/vps/install-taco-model.sh --local
#
# One-time permission fix (optional, avoids sudo each time):
#   sudo chown -R deploy:deploy /var/www/decleanup/gpu-inference-service
#
set -euo pipefail

REMOTE_BASE="${VPS_DECLEANUP:-/var/www/decleanup}"
REMOTE_GPU="${VPS_GPU_DIR:-${REMOTE_BASE}/gpu-inference-service}"
TACO_VARIANT="${TACO_VARIANT:-n}"
MODEL_FILE="yolov8-taco.pt"
MODEL_VERSION="yolov8-taco-${TACO_VARIANT}-100epochs-v1"
DEPLOY_USER="${DEPLOY_USER:-$(whoami 2>/dev/null || echo deploy)}"

case "$TACO_VARIANT" in
  n) TACO_RUN="yolov8n_100epochs" ;;
  m) TACO_RUN="yolov8m_100epochs" ;;
  *) echo "TACO_VARIANT must be n or m" >&2; exit 1 ;;
esac

TACO_URL="https://raw.githubusercontent.com/jeremy-rico/litter-detection/master/runs/detect/train/${TACO_RUN}/weights/best.pt"

die() { echo "Error: $*" >&2; exit 1; }

dir_writable() {
  local d="$1"
  [[ -d "$d" ]] && [[ -w "$d" ]]
}

ensure_gpu_dir() {
  local dest_dir="$1"
  if [[ -d "$dest_dir" ]]; then return 0; fi
  if command -v sudo >/dev/null && [[ "${USE_SUDO:-}" == "1" ]]; then
    sudo mkdir -p "$dest_dir"
    sudo chown "${DEPLOY_USER}:${DEPLOY_USER}" "$dest_dir"
  else
    mkdir -p "$dest_dir" || die "Cannot create ${dest_dir}. Run: sudo mkdir -p ${dest_dir} && sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${dest_dir}"
  fi
}

install_file_to() {
  local src="$1"
  local dest="$2"
  local dest_dir
  dest_dir="$(dirname "$dest")"
  ensure_gpu_dir "$dest_dir"

  if dir_writable "$dest_dir"; then
    mv -f "$src" "$dest"
  elif [[ "${USE_SUDO:-}" == "1" ]] && command -v sudo >/dev/null; then
    echo "→ sudo install into ${dest_dir}"
    sudo install -m 644 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "$src" "$dest"
    rm -f "$src"
  else
    ls -ld "$dest_dir" >&2 || true
    die "Cannot write to ${dest_dir}. Re-run with USE_SUDO=1 or: sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${dest_dir}"
  fi
  ls -lh "$dest"
}

write_env_gpu() {
  local gpu_dir="$1"
  local secret="" tmp
  if [[ -f "${gpu_dir}/.env.gpu" ]]; then
    secret="$(grep -E '^SHARED_SECRET=' "${gpu_dir}/.env.gpu" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  fi
  tmp="$(mktemp /tmp/env-gpu-XXXXXX)"
  {
    echo "# Managed by scripts/vps/install-taco-model.sh"
    echo "MODEL_PATH=${MODEL_FILE}"
    echo "MODEL_VERSION=${MODEL_VERSION}"
    echo "HOST=127.0.0.1"
    echo "PORT=8000"
    if [[ -n "$secret" ]]; then echo "SHARED_SECRET=${secret}"; else echo "# SHARED_SECRET=set-me-same-as-frontend-GPU_SHARED_SECRET"; fi
  } > "$tmp"
  install_file_to "$tmp" "${gpu_dir}/.env.gpu"
  echo "→ Wrote ${gpu_dir}/.env.gpu"
}

download_taco_to_tmp() {
  local tmp
  tmp="$(mktemp /tmp/yolov8-taco-XXXXXX.pt)"
  echo "→ Downloading TACO weights (${TACO_RUN})..."
  echo "  ${TACO_URL}"
  curl -fsSL --retry 3 --retry-delay 2 -o "$tmp" "$TACO_URL" || die "curl failed — try --from-local from your Mac"
  local size
  size="$(wc -c < "$tmp" | tr -d ' ')"
  [[ "$size" -ge 1000000 ]] || die "Download too small (${size} bytes)"
  echo "$tmp"
}

restart_gpu_pm2() {
  local gpu_dir="$1"
  [[ "${SKIP_PM2_RESTART:-}" == "1" ]] && { echo "→ SKIP_PM2_RESTART=1"; return 0; }
  cd "$gpu_dir"
  if pm2 describe decleanup-gpu >/dev/null 2>&1; then
    pm2 restart decleanup-gpu --update-env
  else
    [[ -d .venv ]] || { python3 -m venv .venv && .venv/bin/pip install -q -U pip && .venv/bin/pip install -q -r requirements.txt; }
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
  sleep 3
  curl -fsS "http://127.0.0.1:8000/health" || echo "(see: pm2 logs decleanup-gpu --lines 50)"
}

install_taco_model() {
  local gpu_dir="$1"
  echo "→ GPU dir: ${gpu_dir} (user: $(whoami), USE_SUDO=${USE_SUDO:-0})"
  if ! dir_writable "$gpu_dir"; then
    echo "⚠  Not writable — will use sudo if USE_SUDO=1"
    ls -ld "$gpu_dir" 2>/dev/null || true
  fi
  local tmp
  tmp="$(download_taco_to_tmp)"
  install_file_to "$tmp" "${gpu_dir}/${MODEL_FILE}"
  write_env_gpu "$gpu_dir"
  restart_gpu_pm2 "$gpu_dir"
}

install_from_staged_model() {
  local gpu_dir="$1" staged="$2"
  [[ -f "$staged" ]] || die "Staged model missing: $staged"
  local tmp
  tmp="$(mktemp /tmp/yolov8-taco-staged-XXXXXX.pt)"
  cp "$staged" "$tmp"
  install_file_to "$tmp" "${gpu_dir}/${MODEL_FILE}"
  write_env_gpu "$gpu_dir"
  restart_gpu_pm2 "$gpu_dir"
}

resolve_ssh_target() {
  if [[ -n "${VPS_SSH:-}" ]]; then echo "$VPS_SSH"
  elif [[ -n "${VPS_HOST:-}" ]]; then
    [[ "$VPS_HOST" == *@* ]] && echo "$VPS_HOST" || echo "deploy@${VPS_HOST}"
  else echo "deploy@207.180.203.243"; fi
}

# sudo needs a TTY when run over SSH; -tt forces one even when stdin is the install script.
ssh_remote() {
  local target="$1"
  shift
  if [[ "${USE_SUDO:-}" == "1" ]]; then
    ssh -tt "$target" "$@"
  else
    ssh "$target" "$@"
  fi
}

upload_from_laptop() {
  local ssh_target="$1"
  local root local_tmp remote_tmp
  root="$(cd "$(dirname "$0")/../.." && pwd)"
  local_tmp="${root}/.cache/yolov8-taco-${TACO_RUN}.pt"
  remote_tmp="/tmp/${MODEL_FILE}"

  mkdir -p "${root}/.cache"
  if [[ ! -f "$local_tmp" ]] || [[ "$(wc -c < "$local_tmp" | tr -d ' ')" -lt 1000000 ]]; then
    echo "→ Downloading on laptop..."
    curl -fsSL --retry 3 -o "${local_tmp}.part" "$TACO_URL"
    mv "${local_tmp}.part" "$local_tmp"
  fi
  ls -lh "$local_tmp"
  echo "→ scp → ${ssh_target}:${remote_tmp}"
  scp "$local_tmp" "${ssh_target}:${remote_tmp}"
  ssh_remote "$ssh_target" \
    REMOTE_GPU="$REMOTE_GPU" \
    USE_SUDO="${USE_SUDO:-1}" \
    DEPLOY_USER="${DEPLOY_USER:-deploy}" \
    SKIP_PM2_RESTART="${SKIP_PM2_RESTART:-}" \
    STAGED_MODEL="$remote_tmp" \
    bash -s -- --staged < "$(dirname "$0")/install-taco-model.sh"
}

# --- entry ---

if [[ "${1:-}" == "--staged" ]]; then
  [[ -n "${STAGED_MODEL:-}" ]] || die "STAGED_MODEL not set"
  install_from_staged_model "$REMOTE_GPU" "$STAGED_MODEL"
  exit 0
fi

if [[ "${1:-}" == "--from-local" ]]; then
  upload_from_laptop "$(resolve_ssh_target)"
  echo "Done."
  exit 0
fi

if [[ "${1:-}" == "--local" ]]; then
  install_taco_model "$REMOTE_GPU"
  exit 0
fi

SSH_TARGET="$(resolve_ssh_target)"
echo "Remote: ${SSH_TARGET}"
if [[ "${USE_SUDO:-1}" == "1" ]]; then
  echo "USE_SUDO=1 — you will be prompted for: (1) SSH password, (2) remote sudo password"
  echo "Tip: run once on VPS to skip sudo later:"
  echo "  sudo chown -R deploy:deploy ${REMOTE_GPU}"
fi
ssh_remote "$SSH_TARGET" \
  REMOTE_GPU="$REMOTE_GPU" \
  REMOTE_BASE="$REMOTE_BASE" \
  TACO_VARIANT="$TACO_VARIANT" \
  TACO_RUN="$TACO_RUN" \
  TACO_URL="$TACO_URL" \
  MODEL_FILE="$MODEL_FILE" \
  MODEL_VERSION="$MODEL_VERSION" \
  USE_SUDO="${USE_SUDO:-1}" \
  DEPLOY_USER="${DEPLOY_USER:-deploy}" \
  SKIP_PM2_RESTART="${SKIP_PM2_RESTART:-}" \
  bash -s -- --local < "$(dirname "$0")/install-taco-model.sh"

echo "Done. Verify: ssh ${SSH_TARGET} 'curl -sS http://127.0.0.1:8000/health'"
