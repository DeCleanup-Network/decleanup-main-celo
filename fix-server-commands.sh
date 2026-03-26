#!/bin/bash
# Commands to run on the server to fix both issues

cat << 'EOF'
# Run these commands on your server:

cd /var/www/decleanup/frontend

# 1. Remove the problematic package from package.json
sed -i '/@next\/swc-darwin-arm64/d' package.json

# 2. Clean everything
rm -rf node_modules package-lock.json

# 3. Install dependencies (this will install heic2any and skip macOS SWC)
npm install

# 4. Rebuild
npm run build

# 5. Restart PM2
pm2 restart decleanup

EOF
