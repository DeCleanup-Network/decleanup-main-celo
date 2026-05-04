#!/usr/bin/env bash
# Apply Nginx limits from docs/VPS_SECURITY_PROTOCOL.md §2 (zones + site include).
# Run ON THE VPS as root: sudo bash scripts/vps/apply-nginx-security-gate.sh
# Or from repo root after copying: sudo bash ./scripts/vps/apply-nginx-security-gate.sh
#
# - Adds limit_conn_zone / limit_req_zone to /etc/nginx/nginx.conf inside http { } if missing
# - Writes /etc/nginx/snippets/decleanup-security.conf
# - Adds `include ...` to the first server { } block that contains listen ... 443 ... in the dapp site file
# - Writes /etc/nginx/snippets/decleanup-expensive-routes.conf (§2.3 stricter limit_req for heavy APIs)
#
set -euo pipefail

NGINX_CONF="${NGINX_CONF:-/etc/nginx/nginx.conf}"
SITE_FILE="${SITE_FILE:-/etc/nginx/sites-available/dapp.decleanup.net}"
SNIPPET="/etc/nginx/snippets/decleanup-security.conf"
SNIPPET_EXPENSIVE="/etc/nginx/snippets/decleanup-expensive-routes.conf"
STAMP="# DeCleanup security gate (VPS_SECURITY_PROTOCOL.md)"
STAMP23="# DeCleanup §2.3 expensive routes (VPS_SECURITY_PROTOCOL.md)"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -f "$NGINX_CONF" ]]; then
  echo "Missing $NGINX_CONF" >&2
  exit 1
fi

if [[ ! -f "$SITE_FILE" ]]; then
  echo "Missing site file: $SITE_FILE (set SITE_FILE=... if different)" >&2
  exit 1
fi

TS="$(date +%Y%m%d%H%M%S)"
cp -a "$NGINX_CONF" "${NGINX_CONF}.bak.${TS}"
cp -a "$SITE_FILE" "${SITE_FILE}.bak.${TS}"

# --- 1) Snippet (server context): limits + body size + timeouts ---
mkdir -p /etc/nginx/snippets
cat >"$SNIPPET" <<EOF
${STAMP}
limit_conn conn_zone 20;
limit_req zone=req_zone burst=40 nodelay;
client_body_timeout 15s;
client_header_timeout 15s;
send_timeout 20s;
keepalive_timeout 20s;
client_max_body_size 12m;
EOF

# --- 1b) Snippet: §2.3 stricter limit_req for heavy APIs (replaces inherited server limit_req for this path)
cat >"$SNIPPET_EXPENSIVE" <<EOF
${STAMP23}
location /api/ml-verification/verify {
    limit_req zone=req_zone burst=10 nodelay;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300;
}
EOF

# --- 2) nginx.conf http { }: shared zones ---
if grep -q 'zone=conn_zone:10m' "$NGINX_CONF" && grep -q 'zone=req_zone:10m' "$NGINX_CONF"; then
  echo "nginx.conf: limit zones already present, skipping insert"
else
  tmp="$(mktemp)"
  awk -v stamp="$STAMP" '
    /^[[:space:]]*http[[:space:]]*\{/ && !done {
      print
      print "    " stamp
      print "    limit_conn_zone $binary_remote_addr zone=conn_zone:10m;"
      print "    limit_req_zone $binary_remote_addr zone=req_zone:10m rate=8r/s;"
      done = 1
      next
    }
    { print }
  ' "$NGINX_CONF" >"$tmp"
  mv "$tmp" "$NGINX_CONF"
  echo "nginx.conf: inserted limit_*_zone into http { }"
fi

# --- 3) Site: include snippets inside first server { } that has listen ... 443 ...
if grep -q 'decleanup-security.conf' "$SITE_FILE" && grep -q 'decleanup-expensive-routes.conf' "$SITE_FILE"; then
  echo "site: security + expensive-route includes already present, skipping"
elif grep -q 'decleanup-security.conf' "$SITE_FILE" && ! grep -q 'decleanup-expensive-routes.conf' "$SITE_FILE"; then
  python3 - <<'PY' "$SITE_FILE" "$SNIPPET_EXPENSIVE"
import sys
path, expensive = sys.argv[1], sys.argv[2]
line_add = f"    include {expensive};\n"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
out = []
inserted = False
for line in lines:
    out.append(line)
    if not inserted and "decleanup-security.conf" in line and "include" in line:
        out.append(line_add)
        inserted = True
if not inserted:
    print("ERROR: include line for decleanup-security.conf not found; add expensive-routes include manually.", file=sys.stderr)
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.writelines(out)
print("site: inserted expensive-routes include after security include")
PY
else
  python3 - <<'PY' "$SITE_FILE" "$SNIPPET" "$SNIPPET_EXPENSIVE"
import re, sys
path, snippet, expensive = sys.argv[1], sys.argv[2], sys.argv[3]
inc = f"    include {snippet};\n    include {expensive};\n"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
out = []
i = 0
inserted = False
while i < len(lines):
    line = lines[i]
    if re.match(r"^\s*server\s*\{\s*$", line) and not inserted:
        j = i + 1
        depth = 1
        block = [line]
        while j < len(lines) and depth > 0:
            block.append(lines[j])
            depth += lines[j].count("{") - lines[j].count("}")
            j += 1
        text = "".join(block)
        if re.search(r"listen\s+.*443", text) and "decleanup-security.conf" not in text:
            out.extend(block[:1])
            out.append(inc)
            out.extend(block[1:])
            inserted = True
            i = j
            continue
        out.extend(block)
        i = j
        continue
    out.append(line)
    i += 1
if not inserted:
    print("ERROR: No server { } block with listen 443 found; add include manually or fix SITE_FILE.", file=sys.stderr)
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.writelines(out)
print("site: inserted security + expensive-routes includes into HTTPS server block")
PY
fi

nginx -t
systemctl reload nginx
echo "Done. Backups: ${NGINX_CONF}.bak.${TS} ${SITE_FILE}.bak.${TS}"
