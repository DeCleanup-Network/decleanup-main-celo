#!/bin/bash

# Fix package.json on server to remove macOS-specific SWC package

SERVER="207.180.203.243"
VPS_FRONTEND_PATH="/var/www/decleanup/frontend"

echo "🔧 Fixing package.json on server..."
echo ""

# Upload fixed package.json
echo "📤 Uploading fixed package.json..."
scp frontend/package.json root@${SERVER}:${VPS_FRONTEND_PATH}/package.json

echo ""
echo "🧹 Cleaning up and reinstalling on server..."
ssh root@${SERVER} << 'EOF'
cd /var/www/decleanup/frontend

# Remove node_modules and package-lock.json to force fresh install
echo "Removing old dependencies..."
rm -rf node_modules package-lock.json

# Remove the problematic package if it exists
echo "Cleaning npm cache..."
npm cache clean --force

# Install dependencies (will auto-select correct SWC for Linux)
echo "Installing dependencies..."
npm install

# Rebuild
echo "Building Next.js app..."
npm run build

# Restart PM2
echo "Restarting PM2..."
pm2 restart decleanup || pm2 start npm --name decleanup -- start

echo ""
echo "✅ Done!"
EOF

echo ""
echo "📋 Check logs:"
echo "  ssh root@${SERVER} 'pm2 logs decleanup'"
