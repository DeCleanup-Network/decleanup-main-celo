# Supabase RLS hardening (Security Advisor)

## Apply to production (`decleanup`)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/dhykmgtynlctpdpbznqj/sql/new).
2. Paste and run the full contents of:
   **`frontend/supabase/migrations/20260527_enable_rls_auth_and_harden_public.sql`**
3. In **Advisors → Security**, click **Rerun linter**.

## What this fixes

| Advisor issue | Tables |
|---------------|--------|
| `rls_disabled_in_public` | `"User"`, `"Account"`, `"Session"`, `"VerificationToken"`, `"UserWallet"`, passkey tables |
| `sensitive_columns_exposed` | Same (tokens, OAuth secrets, passkey unlock material) |
| `rls_enabled_no_policy` (Info) | Safe to ignore, or run optional migration below to clear |

## Optional: clear Info (“RLS enabled, no policy”)

1. Run **`20260527_rls_explicit_deny_policies.sql`** in SQL Editor.
2. **Rerun linter** — should show 0 errors, 0 warnings, 0 info.

Adds explicit `api_access_denied` policies (`USING (false)`). Same security as before; only satisfies the linter.

## App access (unchanged)

- **Auth.js / Prisma:** `DATABASE_URL` (direct Postgres) — not subject to PostgREST.
- **Airdrop, cDCU, verifier, hypercerts:** `SUPABASE_SERVICE_ROLE_KEY` on the server (bypasses RLS).
- **Impact portfolio public read:** `impact_portfolios` keeps `impact_portfolios_read_all` for anon SELECT only.

## Required env (Vercel)

- `SUPABASE_SERVICE_ROLE_KEY` — server only, never `NEXT_PUBLIC_*`
- Do not rely on `NEXT_PUBLIC_SUPABASE_ANON_KEY` for server writes
