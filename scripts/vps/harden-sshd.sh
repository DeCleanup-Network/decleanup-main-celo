#!/usr/bin/env bash
# Apply SSH hardening from docs/VPS_SECURITY_PROTOCOL.md §5 (drop-in, validated, reload).
# Run ON THE VPS as root after a non-root deploy user can log in with an SSH key:
#   sudo bash /path/to/DCUCELOMVP/scripts/vps/harden-sshd.sh
#
# - Writes /etc/ssh/sshd_config.d/99-decleanup-hardening.conf
# - Requires main sshd_config to Include sshd_config.d (default on Ubuntu/Debian)
# - Runs sshd -t, then try-reload-or-restart ssh (or sshd)
#
# WARNING: PasswordAuthentication no locks out password-only logins. Ensure pubkey works
# for your deploy user before running. Keep an open root/admin session until you verify
# a new login: ssh -o BatchMode=yes deploy@your-vps-ip
#
set -euo pipefail

DROPIN="/etc/ssh/sshd_config.d/99-decleanup-hardening.conf"
STAMP="# DeCleanup SSH hardening (VPS_SECURITY_PROTOCOL.md §5)"
SSHD_MAIN="${SSHD_MAIN:-/etc/ssh/sshd_config}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -f "$SSHD_MAIN" ]]; then
  echo "Missing $SSHD_MAIN" >&2
  exit 1
fi

if ! grep -qE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' "$SSHD_MAIN"; then
  echo "ERROR: $SSHD_MAIN must include drop-in directory. Add near the top of the file:" >&2
  echo "  Include /etc/ssh/sshd_config.d/*.conf" >&2
  exit 1
fi

mkdir -p /etc/ssh/sshd_config.d

TS="$(date +%Y%m%d%H%M%S)"
if [[ -f "$DROPIN" ]]; then
  cp -a "$DROPIN" "${DROPIN}.bak.${TS}"
fi

cat >"$DROPIN" <<EOF
${STAMP}
# Do not edit manually; re-run harden-sshd.sh from the repo or adjust and sshd -t.

PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
EOF

chmod 0644 "$DROPIN"

if ! sshd -t; then
  echo "sshd -t failed. Restoring backup if present." >&2
  if [[ -f "${DROPIN}.bak.${TS}" ]]; then
    mv "${DROPIN}.bak.${TS}" "$DROPIN"
  else
    rm -f "$DROPIN"
  fi
  exit 1
fi

restart_ssh() {
  if systemctl cat ssh.service &>/dev/null; then
    systemctl try-reload-or-restart ssh.service
    echo "Applied: reloaded/restarted ssh.service"
    return 0
  fi
  if systemctl cat sshd.service &>/dev/null; then
    systemctl try-reload-or-restart sshd.service
    echo "Applied: reloaded/restarted sshd.service"
    return 0
  fi
  echo "ERROR: Neither ssh.service nor sshd.service found." >&2
  return 1
}

restart_ssh

echo "Done. Drop-in: $DROPIN"
echo "Verify key login in a NEW terminal before closing this session:"
echo "  ssh -o BatchMode=yes <user>@<host>"
