#!/usr/bin/env bash
# Load GPU_SHARED_SECRET from frontend/.env.local and run uvicorn on :8000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/frontend/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  export GPU_SHARED_SECRET="$(grep -E '^GPU_SHARED_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
  export SHARED_SECRET="${GPU_SHARED_SECRET:-}"
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
VENV="$DIR/.venv/bin/uvicorn"
if [[ -x "$VENV" ]]; then
  exec "$VENV" main:app --host 127.0.0.1 --port 8000
fi
exec uvicorn main:app --host 127.0.0.1 --port 8000
