# VPS Security Protocol (DeCleanup App)

Deploy and ML setup: **`docs/VPS_DEPLOYMENT.md`**. Secrets: **`docs/SECRETS_ROTATION.md`**.

Production deployment on VPS where `next start` is behind Nginx and managed by PM2.

Primary goals:

1. Reduce abuse traffic (bots, floods, scraping, brute-force).
2. Prevent expensive endpoints from slowing the server.
3. Keep service recoverable under stress.

---

## 1) Baseline Host Hardening (Mandatory)

SSH to VPS:

```bash
ssh root@207.180.203.243
```

### 1.1 Create non-root deploy user (recommended)

```bash
adduser deploy
usermod -aG sudo deploy
```

Use SSH keys and disable password auth for SSH.

### 1.2 System updates + security patches

```bash
apt-get update
apt-get upgrade -y
apt-get autoremove -y
```

Set automatic security updates:

```bash
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

### 1.3 Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Never expose internal app port `3000` publicly.

---

## 2) Nginx as Security Gate (Mandatory)

Nginx should be the only public entrypoint (80/443), proxying to `127.0.0.1:3000`.

**Automated apply (recommended):** on the VPS, with the repo (or script) present, run:

`sudo bash /path/to/DCUCELOMVP/scripts/vps/apply-nginx-security-gate.sh`

It adds the zones to `nginx.conf`, writes `/etc/nginx/snippets/decleanup-security.conf` and `/etc/nginx/snippets/decleanup-expensive-routes.conf` (§2.3 stricter `limit_req` for `/api/ml-verification/verify`), injects `include` lines into the HTTPS `server` block for `dapp.decleanup.net`, runs `nginx -t`, and reloads Nginx. Manual snippets below stay the reference.

### 2.1 Add request and connection limits

In `/etc/nginx/nginx.conf` under `http { ... }`, add:

```nginx
# Per-IP concurrent connections
limit_conn_zone $binary_remote_addr zone=conn_zone:10m;

# Per-IP request rate
limit_req_zone $binary_remote_addr zone=req_zone:10m rate=8r/s;
```

In your site block (`/etc/nginx/sites-available/dapp.decleanup.net`) under `server { ... }`, add:

```nginx
# Apply global limits
limit_conn conn_zone 20;
limit_req zone=req_zone burst=40 nodelay;

# Timeouts to cut slowloris-like behavior
client_body_timeout 15s;
client_header_timeout 15s;
send_timeout 20s;
keepalive_timeout 20s;
```

### 2.2 Limit upload body size

Your app already validates file size. Enforce at edge too:

```nginx
client_max_body_size 12m;
```

### 2.3 Optional stricter limits for expensive routes

For known heavy APIs:

```nginx
location /api/ml-verification/verify {
    limit_req zone=req_zone burst=10 nodelay;
    proxy_pass http://127.0.0.1:3000;
    # usual proxy headers...
}
```

The apply script writes this as `/etc/nginx/snippets/decleanup-expensive-routes.conf` and includes it next to the §2.1 snippet. For that path, the location’s `limit_req` replaces the inherited server-level `limit_req` (same zone, tighter burst).

Reload after changes:

```bash
nginx -t && systemctl reload nginx
```

---

## 3) App/API Protection Rules

## 3.1 Require auth/secret on sensitive server routes

Already relevant in this project:

- GPU inference shared secret.
- Verifier/admin endpoints should verify role/auth server-side, not just UI.

Do not trust client-only checks.

## 3.2 Rate-limit at API layer for high-cost endpoints

Implement lightweight in-memory limiter for:

- `/api/ipfs/upload`
- `/api/ml-verification/verify`
- any RPC proxy endpoints

Use key = IP + wallet address (if available), short window (e.g., 1 min) + burst cap.

## 3.3 Request validation

For all API routes:

- Strict JSON/body schema validation.
- Reject oversized bodies early.
- Reject unsupported mime types early.
- Set request timeouts for upstream calls (Pinata, RPC, GPU service).

---

## 4) DDoS / Abuse Mitigation Layers

VPS alone is weak against large volumetric attacks. Add an edge service:

- Cloudflare (recommended), or another WAF/CDN.

Minimum edge setup:

- Proxy DNS through Cloudflare.
- Enable WAF managed rules.
- Enable bot protection.
- Enable rate limiting rules for `/api/*`.
- Challenge suspicious countries/ASNs if needed.

Without edge protection, large floods can saturate network before Nginx can help.

---

## 5) SSH and Brute-Force Defense

Install fail2ban:

```bash
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

**Automated apply (recommended):** on the VPS, after a non-root deploy user can log in with an SSH key, run:

`sudo bash /path/to/DCUCELOMVP/scripts/vps/harden-sshd.sh`

It writes `/etc/ssh/sshd_config.d/99-decleanup-hardening.conf`, runs `sshd -t`, then `systemctl try-reload-or-restart` on `ssh` or `sshd` (whichever exists). **Do not** run until pubkey login works for that user; `PasswordAuthentication no` will lock out password-only access.

Manual hardening (same settings as the script):

- `PermitRootLogin no` (only after your deploy user works with a key)
- `PasswordAuthentication no`
- `PubkeyAuthentication yes`
- `MaxAuthTries 3`

Then reload SSH so the config is applied without guessing the unit name:

```bash
sshd -t && (systemctl try-reload-or-restart ssh 2>/dev/null || systemctl try-reload-or-restart sshd)
```

On Debian/Ubuntu the service is usually `ssh`; on some distros it is `sshd`. Verify a **second** login before closing your session: `ssh -o BatchMode=yes user@server`.

---

## 6) Runtime and Process Safety

## 6.1 PM2 controls

- Keep only required processes running.
- Use restart delay and max memory limit (if not already set in ecosystem file).

This repo sets these in PM2 ecosystem files - adjust for your VPS RAM:

- **Next.js:** `frontend/ecosystem.config.js` - `max_memory_restart: '1G'`, `restart_delay: 4000` (plus `min_uptime` / `max_restarts`).
- **GPU inference (same host):** `gpu-inference-service/ecosystem.config.cjs` - `max_memory_restart: '4G'`, `restart_delay: 3000` (plus `min_uptime` / `max_restarts`).

Example values for a smaller tier:

```js
max_memory_restart: '700M',
restart_delay: 3000
```

**Apply changes on the VPS:** after `git pull`, reload PM2 so new ecosystem settings take effect. From your **Mac** (repo root): `VPS_SSH=user@your-vps ./scripts/vps/reload-pm2-stacks.sh` - or on the **VPS**: `./scripts/vps/reload-pm2-stacks.sh --local`. (Automation here cannot SSH into your server; that script is the one-liner substitute.)

## 6.2 Resource isolation

If GPU service is on same VPS:

- Reserve CPU/RAM budget for frontend and GPU separately.
- Monitor load spikes to prevent one service starving the other.

---

## 7) Monitoring and Alerting (Mandatory)

Track at minimum:

- CPU, RAM, disk usage
- Nginx 4xx/5xx rates
- request latency (p95/p99)
- PM2 restarts/crashes
- endpoint hit rates (`/api/ml-verification/verify`, `/api/ipfs/upload`)

Basic commands:

```bash
pm2 status
pm2 logs decleanup --lines 200
tail -n 200 /var/log/nginx/access.log
tail -n 200 /var/log/nginx/error.log
```

Set alerts for:

- sustained CPU > 85%
- memory > 85%
- sudden 429/5xx spikes
- repeated restart loops

**Automated baseline (repo script, on the VPS):** `scripts/vps/local-threshold-check.sh` exits `1` when something looks wrong so you can hook **cron + `MAILTO`**, systemd, or a notifier:

- **Memory:** used RAM % vs total (from `free`) &gt; `THRESHOLD_MEM_PCT` (default 85).
- **CPU (proxy):** 1-minute load average vs `nproc` as a % &gt; `THRESHOLD_LOAD_PCT` (default 85) - same order of magnitude as “sustained CPU” on Linux without extra packages.
- **429 / 5xx:** counts lines in the last `ACCESS_TAIL_LINES` of `NGINX_ACCESS_LOG` where status is 429 or 5xx (combined log: status field `$9`) &gt; `THRESHOLD_HTTP_ERRORS` (tune for traffic).
- **PM2 restart loops:** compares restart counts for `decleanup` and `decleanup-gpu` to the previous run (state under `/var/tmp/decleanup-monitoring/`); alerts if increase ≥ `PM2_RESTART_BURST` (default 8) between runs.

Example cron (every 5 minutes, mail root on failure):

```cron
MAILTO=you@example.com
*/5 * * * * root /var/www/decleanup/DCUCELOMVP/scripts/vps/local-threshold-check.sh
```

For **edge** 429/5xx and global latency, add Cloudflare (or similar) dashboards/alerts in addition to this script.

---

## 8) Logging Hygiene and Data Safety

- Never log secrets/JWT/private keys.
- Avoid logging full user payloads for uploads.
- Rotate logs (`logrotate`) to avoid disk fill.

If a secret is exposed:

1. rotate immediately,
2. revoke old credential,
3. redeploy with new secret,
4. audit access logs.

---

## 9) Incident Response Playbook (When Server Is Slow)

1. Confirm if traffic spike is real:
   - Nginx access log volume and top IPs.
2. Apply temporary emergency limits:
   - tighter `limit_req`, `limit_conn`,
   - temporary IP blocks (`ufw deny from <ip>`).
3. Restart only if needed:
   - `pm2 restart decleanup --update-env`
4. If under heavy attack:
   - enable stricter Cloudflare/WAF challenge mode.
5. After stabilization:
   - review logs,
   - tune permanent limits,
   - document root cause.

---

## 10) DeCleanup-Specific High-Value Controls

Priority order for this project:

1. Ensure Celo RPC is correct and stable (avoid dead endpoints causing timeout storms).
2. Rate-limit AI verification endpoints aggressively.
3. Keep upload size checks at both Nginx and app route.
4. Cache contract reads (already added) to reduce repeated RPC load.
5. Serve app via HTTPS domain (`dapp.decleanup.net`) behind Nginx.
6. Add edge WAF/CDN (Cloudflare) for real DDoS resilience.

---

## 11) Quick Security Checklist

- [ ] UFW enabled (only 22, 80, 443 open).
- [ ] Nginx reverse proxy only; app on `127.0.0.1:3000`.
- [ ] TLS certificate active and auto-renewing.
- [ ] Nginx rate limits and upload size caps configured.
- [ ] fail2ban enabled.
- [ ] SSH password login disabled.
- [ ] Sensitive API routes authenticated.
- [ ] App-level rate limiting on expensive endpoints.
- [ ] Monitoring and alerting in place.
- [ ] Secrets rotation procedure documented and tested.

### 11.1 Already in this repo (no VPS access required from tooling)

- **Nginx limits + upload cap + expensive-route snippet:** `scripts/vps/apply-nginx-security-gate.sh` (see §2).
- **SSH hardening drop-in:** `scripts/vps/harden-sshd.sh` (see §5).
- **App-level rate limits + JSON/body validation + upstream timeouts:** `frontend` API routes (`api-request-guards`, `rate-limit`, etc.; see §3.2-3.3).
- **PM2 memory / restart tuning:** `frontend/ecosystem.config.js`, `gpu-inference-service/ecosystem.config.cjs` (see §6.1).
- **Reload PM2 after pull:** `scripts/vps/reload-pm2-stacks.sh`.
- **Cron-style monitoring checks:** `scripts/vps/local-threshold-check.sh` (see §7).
- **Secrets rotation runbook:** `docs/SECRETS_ROTATION.md`.

### 11.2 Your steps (run these yourself - one checklist item per block)

**1. UFW (only 22, 80, 443)** - on VPS:

```bash
sudo ufw status verbose
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Ensure **3000/tcp is not** allowed publicly (`sudo ufw status numbered`).

**2. Nginx reverse proxy; app on 127.0.0.1:3000** - on VPS:

```bash
sudo ss -tlnp | grep -E ':80|:443|:3000'
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

Confirm Nginx listens on 80/443 and the app listens on `127.0.0.1:3000` (not `0.0.0.0:3000` in production if you rely on localhost binding - verify `ecosystem`/Next `HOST`).

**3. TLS active + auto-renew** - on VPS:

```bash
sudo certbot certificates
sudo systemctl status certbot.timer
```

From your Mac:

```bash
curl -sSI https://dapp.decleanup.net | head -5
```

**4. Nginx rate limits + upload caps** - on VPS (after repo is present):

```bash
sudo bash /var/www/decleanup/DCUCELOMVP/scripts/vps/apply-nginx-security-gate.sh
```

**5. fail2ban** - on VPS:

```bash
sudo apt-get update && sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
sudo systemctl status fail2ban --no-pager
```

**6. SSH password login disabled** - on VPS **only after** key login works for your deploy user:

```bash
ssh -o BatchMode=yes deploy@YOUR_VPS_IP
sudo bash /var/www/decleanup/DCUCELOMVP/scripts/vps/harden-sshd.sh
```

**7. Sensitive API routes authenticated** - verify env and behavior (VPS + deploy process):

- GPU: `GPU_SHARED_SECRET` set and matches inference service `.env.gpu`.
- Verifier/admin routes: follow `frontend/src/lib/verifier/` / production env; confirm non-public callers cannot invoke privileged actions.

```bash
# Example: confirm PM2 sees secrets (do not paste values in chat)
sudo grep -E '^(GPU_SHARED_SECRET|PINATA_JWT)=' /var/www/decleanup/frontend/.env.local | sed 's/=.*/=***/'
```

**8. App-level rate limiting** - already in code; after deploy confirm responses:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://dapp.decleanup.net/api/rpc/celo-sepolia -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

Repeat rapidly only in a safe test; expect **429** when limits trip (see §3.2).

**9. Monitoring and alerting** - on VPS (install cron or systemd timer):

```bash
sudo chmod +x /var/www/decleanup/DCUCELOMVP/scripts/vps/local-threshold-check.sh
sudo /var/www/decleanup/DCUCELOMVP/scripts/vps/local-threshold-check.sh
```

Add cron (example: root mail on failure):

```cron
MAILTO=you@example.com
*/5 * * * * root /var/www/decleanup/DCUCELOMVP/scripts/vps/local-threshold-check.sh
```

**10. Secrets rotation documented and tested** - follow `docs/SECRETS_ROTATION.md`, execute a dry run on non-production or a maintenance window, then check the boxes in that file.

