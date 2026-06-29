# Pre-Launch Security — Manual Steps

Code fixes from the security audit are in the repo. Complete these steps yourself before public launch.

---

## Step 1 — Find your Vercel region

Your Supabase database is in **US East (Ohio) — `us-east-2`**. You should know where Vercel runs your API routes too.

1. Open [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **decleanup** (or dapp) project
3. Go to **Settings → Functions**
4. Note **Function Region** (e.g. `Washington, D.C., USA (iad1)` or `Frankfurt, Germany (fra1)`)
5. Update [`docs/PRIVACY_POLICY.md`](PRIVACY_POLICY.md) section **5a** and the in-app [`/privacy`](../frontend/src/app/privacy/page.tsx) page with the exact region name once confirmed

**Quick check without the dashboard:** deploy a one-off API route that returns `process.env.VERCEL_REGION` (Vercel injects this at runtime, e.g. `iad1`).

---

## Step 2 — Decide if US-only storage is acceptable

Current setup:

| Service | Region |
|---------|--------|
| Supabase Postgres | **US East (Ohio) — `us-east-2`** |
| Vercel | **US East — `iad1` (Washington, D.C.)** |

If you need EU data residency (GDPR preference, EU users, counsel advice):

- **Supabase:** you cannot change region on an existing project. Create a **new project** in EU (e.g. `eu-west-1` Ireland or `eu-central-1` Frankfurt), export/import data, update env vars, redeploy.
- **Vercel:** change Function Region in project settings (may require redeploy).

This is a **multi-hour migration**, not a toggle. Discuss with counsel before moving.

---

## Step 3 — Clear Supabase Security Advisor Info items

You have **0 errors, 0 warnings, 15 info** (“RLS Enabled No Policy”). That is safe but noisy.

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/dhykmgtynlctpdpbznqj/sql/new)
2. Confirm `20260527_enable_rls_auth_and_harden_public.sql` was already applied (your screenshot suggests yes)
3. Paste and run the full contents of:
   `frontend/supabase/migrations/20260527_rls_explicit_deny_policies.sql`
4. Go to **Advisors → Security → Rerun linter**
5. Target: **0 errors, 0 warnings, 0 info**

---

## Step 4 — Enable global rate limiting (Upstash)

In-memory limits do not work reliably on Vercel (each instance has its own counter).

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com)
2. Copy **REST URL** and **REST TOKEN**
3. In **Vercel → Project → Settings → Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy production

The app uses Upstash automatically when these vars are set (claim routes, hypercerts, verifier apply). Without them, it falls back to per-instance in-memory limits.

---

## Step 5 — Set ops diagnostic secret (production)

Diagnostic routes are now **404 in production** unless authorized:

- `GET /api/ipfs/upload`
- `GET /api/hypercerts/requests/publish`
- `GET /api/telegram/submission-created`

1. Generate a secret: `openssl rand -hex 32`
2. Add to Vercel (Production): `OPS_DIAGNOSTIC_SECRET=<your secret>`
3. Redeploy
4. When debugging, call with header: `x-ops-diagnostic-secret: <your secret>`

---

## Step 6 — Run the 4-point auth failure test

Test manually against production (or staging):

| Test | What to check |
|------|----------------|
| Wrong password 5× | Generic error; no “email exists” leak. Wallet unlock lockout is client-side only — note for counsel. |
| Password reset for unknown email | Same response as known email (Auth.js should not enumerate) |
| Click verification link twice | Graceful handling, no crash |
| Sign up with existing email | No “user already exists” leak |

Document results in your launch checklist.

---

## Step 7 — Add CAPTCHA on public write forms

Not implemented in code (requires your Cloudflare account).

1. Sign up at [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (free)
2. Create a site key + secret for `dapp.decleanup.net`
3. Add to Vercel: `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
4. Wire verification on: verifier apply, claim request forms (future PR or ask agent)

---

## Step 8 — Review Pimlico API key exposure

`NEXT_PUBLIC_PIMLICO_API_KEY` is embedded in the browser for account abstraction. That is common but abusable for billing.

1. Prefer server-only `PIMLICO_API_KEY` where possible
2. Set usage caps/alerts in the [Pimlico dashboard](https://dashboard.pimlico.io)
3. Rotate the key if it was ever committed to git

---

## Step 9 — Set billing alerts on paid APIs

| Provider | Action |
|----------|--------|
| OpenAI / Anthropic | Hard daily cap + email at 50% |
| Pinata | Usage alerts in dashboard |
| Supabase | Billing alerts in org settings |
| Vercel | Spending limits in team settings |
| Pimlico | Usage monitoring |

---

## Step 10 — Enable Supabase backups

Your dashboard shows **“No backups”** on the free tier.

1. Supabase **Settings → Database → Backups** — upgrade to Pro if you need automated daily backups
2. Until then, periodic manual exports via SQL dump or Supabase CLI

---

## Step 11 — Connect GitHub to Supabase (optional but recommended)

Dashboard shows **“No repository connected”**.

1. Supabase → **Project Settings → Integrations → GitHub**
2. Link repo so migrations in `frontend/supabase/migrations/` deploy via CI instead of manual SQL paste

---

## Step 12 — Final verification before launch

- [ ] Vercel region documented in privacy policy
- [ ] Supabase Security Advisor: 0 / 0 / 0
- [ ] `UPSTASH_REDIS_REST_*` set on Vercel
- [ ] `OPS_DIAGNOSTIC_SECRET` set on Vercel
- [ ] Auth failure tests passed
- [ ] No secrets in git history (`git log -p` spot-check or use GitHub secret scanning)
- [ ] Production deploy uses `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`)
- [ ] Counsel sign-off recorded for privacy policy + terms

---

## What was fixed in code (this session)

| Area | Change |
|------|--------|
| Privacy policy | Counsel-reviewed wording; Supabase region documented |
| `/privacy` page | Data storage section added |
| HSTS | Added in production via `csp-headers.mjs` |
| API errors | Generic messages in production; no schema/env leaks on key routes |
| Diagnostic GETs | Gated in production (`OPS_DIAGNOSTIC_SECRET`) |
| Pinata | Removed `NEXT_PUBLIC_PINATA_*` fallbacks |
| Rate limits | Upstash support + limits on claim/hypercert/verifier routes |
| Error UI | `error.tsx` / `global-error.tsx` hide raw messages in production |
