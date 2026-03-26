#!/bin/bash
# Commands to check build error on server

cat << 'EOF'
# Run these commands on the server to see the full error:

cd /var/www/decleanup/frontend

# Check the last build output
npm run build 2>&1 | tail -50

# Or check PM2 logs for runtime errors
pm2 logs decleanup --lines 50

# Or check if there are TypeScript errors
npx tsc --noEmit 2>&1 | head -30

EOF
