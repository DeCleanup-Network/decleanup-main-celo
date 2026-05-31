#!/bin/bash
# SSH access help for VPS 207.180.203.243 — see docs/VPS_DEPLOYMENT.md

echo "SSH public key:"
cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub 2>/dev/null
echo ""
echo "Try: ssh deploy@207.180.203.243"
echo "Hardening: scripts/vps/harden-sshd.sh (after key login works)"
