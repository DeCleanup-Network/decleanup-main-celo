#!/usr/bin/env bash
# Build password-protected zip for ML verification dev handoff.
#
# Usage:
#   1. Copy secrets template and fill from VPS:
#        cp handoff/ml-verification-dev-pack/04-SECRETS.env.template \
#           handoff/ml-verification-dev-pack/04-SECRETS.env
#        # edit 04-SECRETS.env with real values
#
#   2. Create archive (password via env or prompt):
#        HANDOFF_ZIP_PASSWORD='your-strong-password' ./scripts/create-ml-handoff-archive.sh
#
#   3. Share zip + password with dev on separate channels.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK_DIR="$ROOT/handoff/ml-verification-dev-pack"
STAGING="$ROOT/handoff/.ml-handoff-staging"
OUT_ZIP="$ROOT/handoff/ml-verification-dev-pack-$(date +%Y%m%d).zip"

if [[ ! -d "$PACK_DIR" ]]; then
  echo "Missing pack dir: $PACK_DIR" >&2
  exit 1
fi

if [[ ! -f "$PACK_DIR/04-SECRETS.env" ]]; then
  echo "ERROR: $PACK_DIR/04-SECRETS.env not found." >&2
  echo "Copy 04-SECRETS.env.template → 04-SECRETS.env and fill secrets from VPS first." >&2
  exit 1
fi

PASSWORD="${HANDOFF_ZIP_PASSWORD:-}"
if [[ -z "$PASSWORD" ]]; then
  echo "Enter zip password (will not echo):"
  read -rs PASSWORD
  echo ""
  if [[ -z "$PASSWORD" ]]; then
    echo "Password required." >&2
    exit 1
  fi
fi

rm -rf "$STAGING"
mkdir -p "$STAGING"
cp "$PACK_DIR"/*.md "$STAGING/"
cp "$PACK_DIR"/*.sh "$STAGING/" 2>/dev/null || true
cp "$PACK_DIR/04-SECRETS.env" "$STAGING/04-SECRETS.env"
chmod 600 "$STAGING/04-SECRETS.env"

rm -f "$OUT_ZIP"
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGING" && zip -r -P "$PASSWORD" "$OUT_ZIP" .)
else
  echo "zip not found; install zip or use 7z" >&2
  exit 1
fi

rm -rf "$STAGING"

echo ""
echo "Created: $OUT_ZIP"
echo "Contents: README, architecture, known issues, testing guide, secrets, diagnostics script, file index."
echo "Share password with dev separately from the zip file."
