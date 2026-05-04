#!/usr/bin/env bash
# Local health thresholds for docs/VPS_SECURITY_PROTOCOL.md §7 (alerts).
# Run ON THE VPS (cron every 5 min is typical). Exit 1 if any check fails so cron can email
# when MAILTO is set, or wrap with your notifier (Slack, Telegram, etc.).
#
# Checks (defaults):
# - Memory used % > THRESHOLD_MEM_PCT (85)
# - Load average (1m) / CPU cores as % > THRESHOLD_LOAD_PCT (85) — proxy for CPU saturation
# - PM2 app restart count jump > PM2_RESTART_BURST vs last run (repeated restart loops)
# - Nginx access log tail: count of 429 + 5xx > THRESHOLD_HTTP_ERRORS (spike proxy)
#
# Usage:
#   sudo bash scripts/vps/local-threshold-check.sh
# Env:
#   PM2_APP=decleanup THRESHOLD_MEM_PCT=90 ./scripts/vps/local-threshold-check.sh
#
set -euo pipefail

THRESHOLD_MEM_PCT="${THRESHOLD_MEM_PCT:-85}"
THRESHOLD_LOAD_PCT="${THRESHOLD_LOAD_PCT:-85}"
THRESHOLD_HTTP_ERRORS="${THRESHOLD_HTTP_ERRORS:-80}"
PM2_APP="${PM2_APP:-decleanup}"
PM2_GPU_APP="${PM2_GPU_APP:-decleanup-gpu}"
PM2_RESTART_BURST="${PM2_RESTART_BURST:-8}"
STATE_DIR="${STATE_DIR:-/var/tmp/decleanup-monitoring}"
NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
ACCESS_TAIL_LINES="${ACCESS_TAIL_LINES:-12000}"

ALERTS=()

mem_pct() {
  free | awk '/Mem:/ {
    if ($2 < 1) { print 0; exit }
    print int(100 * ($2 - $7) / $2)
  }'
}

load_pct() {
  local cores load1
  cores=$(nproc 2>/dev/null || echo 1)
  [[ "$cores" -lt 1 ]] && cores=1
  load1=$(awk '{print $1}' /proc/loadavg)
  awk -v l="$load1" -v c="$cores" 'BEGIN { printf "%.0f", (l / c) * 100 }'
}

check_mem() {
  local m
  m=$(mem_pct)
  if [[ "$m" -gt "$THRESHOLD_MEM_PCT" ]]; then
    ALERTS+=("memory ${m}% (threshold ${THRESHOLD_MEM_PCT}%)")
  fi
}

check_load() {
  local lp
  lp=$(load_pct)
  if [[ "$lp" -gt "$THRESHOLD_LOAD_PCT" ]]; then
    ALERTS+=("load_avg_vs_cores ${lp}% (threshold ${THRESHOLD_LOAD_PCT}%; 1m load vs nproc)")
  fi
}

pm2_restarts() {
  local app="$1"
  if ! command -v pm2 &>/dev/null; then
    echo ""
    return 0
  fi
  pm2 show "$app" 2>/dev/null | grep -m1 '│ restarts' | grep -oE '[0-9]+' | head -1 || true
}

check_pm2_restart_burst() {
  local app now prev delta name
  mkdir -p "$STATE_DIR"
  for app in "$PM2_APP" "$PM2_GPU_APP"; do
    name=$(echo "$app" | tr '/' '_')
    now=$(pm2_restarts "$app")
    [[ -z "$now" ]] && continue
    prev="$now"
    [[ -f "${STATE_DIR}/pm2_restarts_${name}" ]] && prev=$(cat "${STATE_DIR}/pm2_restarts_${name}")
    echo "$now" >"${STATE_DIR}/pm2_restarts_${name}"
    delta=$((now - prev))
    if [[ "$delta" -ge "$PM2_RESTART_BURST" ]]; then
      ALERTS+=("PM2 restart burst: ${app} restarts +${delta} since last run (threshold ${PM2_RESTART_BURST})")
    fi
  done
}

check_nginx_http_errors() {
  local bad
  [[ ! -f "$NGINX_ACCESS_LOG" ]] && return 0
  # Default Nginx combined log: HTTP status is $9
  bad=$(tail -n "$ACCESS_TAIL_LINES" "$NGINX_ACCESS_LOG" 2>/dev/null | awk '$9 ~ /^(429|5[0-9][0-9])$/ { c++ } END { print c+0 }' || echo 0)
  if [[ "${bad:-0}" -gt "$THRESHOLD_HTTP_ERRORS" ]]; then
    ALERTS+=("nginx 429/5xx count ${bad} in last ~${ACCESS_TAIL_LINES} lines (threshold ${THRESHOLD_HTTP_ERRORS})")
  fi
}

check_mem
check_load
check_pm2_restart_burst
check_nginx_http_errors

if [[ ${#ALERTS[@]} -eq 0 ]]; then
  echo "OK — mem $(mem_pct)% load_vs_cores $(load_pct)%"
  exit 0
fi

echo "ALERT:" >&2
for a in "${ALERTS[@]}"; do
  echo " - $a" >&2
done
exit 1
