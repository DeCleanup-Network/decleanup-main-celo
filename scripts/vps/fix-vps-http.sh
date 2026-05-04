#!/usr/bin/env bash
#
# Run ON THE VPS as root (after copying this repo path or scp'ing this file):
#   scp scripts/vps/fix-vps-http.sh scripts/vps/nginx-decleanup-ip.conf root@YOUR_IP:/root/
#   ssh root@YOUR_IP 'bash /root/fix-vps-http.sh --fix'
#
# Without --fix: only prints what is listening (audit).
# With --fix: installs nginx, proxies port 80 -> 127.0.0.1:3000, opens ufw for 80/443.
#
set -euo pipefail

FIX=0
for arg in "$@"; do
  case "$arg" in
    --fix) FIX=1 ;;
    -h|--help)
      echo "Usage: $0 [--fix]"
      echo "  (no args)  Audit listeners, firewall, nginx, pm2 hints"
      echo "  --fix      Install/configure nginx for :80 -> :3000 and ufw allow 80,443"
      exit 0
      ;;
  esac
done

echo "=========================================="
echo "VPS audit ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "=========================================="
echo

echo "--- Listening TCP (ss -tlnp) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null || ss -tln
else
  netstat -tlnp 2>/dev/null || netstat -tln
fi
echo

echo "--- UDP (common) ---"
ss -ulnp 2>/dev/null | head -20 || true
echo

echo "--- nginx ---"
if command -v nginx >/dev/null 2>&1; then
  nginx -v
  systemctl is-active nginx 2>/dev/null || true
else
  echo "nginx: not installed"
fi
echo

echo "--- ufw ---"
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose 2>/dev/null || ufw status
else
  echo "ufw: not installed"
fi
echo

echo "--- pm2 (if present) ---"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || true
else
  echo "pm2: not installed"
fi
echo

echo "--- Port summary (what users expect) ---"
for port in 80 443 3000 8000 22; do
  if ss -tln 2>/dev/null | grep -qE ":${port}\\b"; then
    echo "  :${port}  LISTEN (TCP)"
  else
    echo "  :${port}  not listening (or filtered)"
  fi
done
echo

if ss -tln 2>/dev/null | grep -qE ':3000\b'; then
  echo "OK: Something is listening on 3000 (Next.js target for nginx)."
else
  echo "WARNING: Nothing on TCP 3000. The site will not load until Next runs, e.g.:"
  echo "  cd /var/www/decleanup/frontend && pm2 start ecosystem.config.js"
  echo "  # or: pm2 restart decleanup"
fi
echo

echo "GPU / ML: Prefer GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000 on this host"
echo "(Next API calls the GPU locally; no need to expose :8000 publicly.)"
echo

if [[ "$FIX" -ne 1 ]]; then
  echo "Audit only. To install nginx reverse proxy + ufw rules, run:"
  echo "  sudo bash $0 --fix"
  exit 0
fi

echo "======== APPLYING --fix (nginx + ufw) ========"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y nginx

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="${SCRIPT_DIR}/nginx-decleanup-ip.conf"
if [[ ! -f "$CONF_SRC" ]]; then
  CONF_SRC="/root/nginx-decleanup-ip.conf"
fi
if [[ ! -f "$CONF_SRC" ]]; then
  echo "Using embedded nginx config (copy nginx-decleanup-ip.conf next to script to customize)."
  cat >/etc/nginx/sites-available/decleanup-ip <<'NGX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
NGX
else
  install -m 644 "$CONF_SRC" /etc/nginx/sites-available/decleanup-ip
fi
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/decleanup-ip /etc/nginx/sites-enabled/decleanup-ip

nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable 2>/dev/null || true
  ufw status verbose
fi

echo
echo "Done. Try: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
echo "If :3000 was empty, start the app then reload the browser."
exit 0
