#!/bin/bash

# Deploy recent changes to VPS
# This script deploys frontend changes including:
# - ML verification API route
# - GPU verification logic
# - HEIC photo handling
# - Level 10 submission limit

set -e

SERVER="207.180.203.243"
VPS_FRONTEND_PATH="/var/www/decleanup/frontend"
LOCAL_FRONTEND_PATH="./frontend"

echo "🚀 Deploying to VPS: $SERVER"
echo "📁 Target: $VPS_FRONTEND_PATH"
echo ""

# Files to deploy
FILES=(
  "src/app/api/ml-verification/verify/route.ts"
  "src/lib/dmrv/gpu-verification.ts"
  "src/features/cleanup/pages/page.tsx"
  "src/lib/blockchain/verification.ts"
  "package.json"
)

echo "📦 Files to deploy:"
for file in "${FILES[@]}"; do
  echo "  - $file"
done
echo ""

# Create directories on VPS if they don't exist
echo "📂 Creating directories on VPS..."
ssh root@${SERVER} "mkdir -p ${VPS_FRONTEND_PATH/src/app/api/ml-verification/verify}"
ssh root@${SERVER} "mkdir -p ${VPS_FRONTEND_PATH}/src/lib/dmrv"
ssh root@${SERVER} "mkdir -p ${VPS_FRONTEND_PATH}/src/features/cleanup/pages"
ssh root@${SERVER} "mkdir -p ${VPS_FRONTEND_PATH}/src/lib/blockchain"

# Deploy files
echo "📤 Uploading files..."
for file in "${FILES[@]}"; do
  local_file="${LOCAL_FRONTEND_PATH}/${file}"
  remote_file="${VPS_FRONTEND_PATH}/${file}"
  
  if [ ! -f "$local_file" ]; then
    echo "⚠️  Warning: $local_file not found, skipping..."
    continue
  fi
  
  echo "  → $file"
  scp "$local_file" "root@${SERVER}:${remote_file}"
done

# Install new dependencies (heic2any)
echo ""
echo "📦 Installing dependencies..."
ssh root@${SERVER} "cd ${VPS_FRONTEND_PATH} && npm install"

# Rebuild Next.js app
echo ""
echo "🔨 Rebuilding Next.js app..."
ssh root@${SERVER} "cd ${VPS_FRONTEND_PATH} && npm run build"

# Restart PM2
echo ""
echo "🔄 Restarting PM2..."
ssh root@${SERVER} "pm2 restart decleanup || pm2 start npm --name decleanup -- start"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Check logs: ssh root@${SERVER} 'pm2 logs decleanup'"
echo "  2. Test ML verification by submitting a cleanup"
echo "  3. Verify HEIC photos work"
echo "  4. Test level 10 submission limit"
