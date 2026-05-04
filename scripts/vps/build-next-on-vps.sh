#!/usr/bin/env bash
# Run ON THE VPS as root after deploying code (creates .next for `next start` / PM2):
#   ssh root@207.180.203.243 'bash -s' < scripts/vps/build-next-on-vps.sh
# Or copy to the server and: bash /root/build-next-on-vps.sh
#
set -euo pipefail
FRONTEND="${VPS_FRONTEND:-/var/www/decleanup/frontend}"
cd "$FRONTEND"
echo "==> $(pwd) — installing deps..."
npm install
echo "==> Building Next.js production bundle (.next)..."
npm run build
echo "==> Restarting PM2..."
pm2 restart decleanup || pm2 start ecosystem.config.js
echo "==> Done. Check: ss -tlnp | grep 3000"
pm2 status
