#!/bin/bash

# Script to help fix SSH access to VPS
# Server: 207.180.203.243

echo "🔐 SSH Access Troubleshooting"
echo "=============================="
echo ""

echo "Your SSH public key:"
echo "--------------------"
cat ~/.ssh/id_ed25519.pub
echo ""
echo ""

echo "📋 Solutions:"
echo ""
echo "1. INTERACTIVE PASSWORD LOGIN (Try this first):"
echo "   ssh root@207.180.203.243"
echo "   (Enter password when prompted)"
echo ""
echo "2. ADD YOUR SSH KEY TO SERVER (After you get in):"
echo "   ssh root@207.180.203.243"
echo "   mkdir -p ~/.ssh"
echo "   echo '$(cat ~/.ssh/id_ed25519.pub)' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo "   chmod 700 ~/.ssh"
echo ""
echo "3. VIA CONTABO DASHBOARD:"
echo "   - Go to https://my.contabo.com"
echo "   - Use VNC Console to access server"
echo "   - Or reset root password via dashboard"
echo ""
echo "4. CHECK SERVER SSH CONFIG (if you can access via VNC):"
echo "   cat /etc/ssh/sshd_config | grep -E 'PermitRootLogin|PasswordAuthentication|PubkeyAuthentication'"
echo ""
