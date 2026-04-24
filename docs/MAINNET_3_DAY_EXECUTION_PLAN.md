# Mainnet 3-Day Execution Plan

This runbook is the shortest safe path from current dev state to mainnet launch with your two known constraints:

- Web3Auth behavior must be validated on deployed URL (not localhost).
- AI model service is reachable only from VPN/VPS environment.

---

## Ground Rules

- No new feature work during these 3 days; only fixes and deployment hardening.
- Keep one release branch as source of truth: **`ai-verification`** (all lowercase). Do not recreate `AI-verification`; GitHub and macOS case-folding make duplicate-casing branches painful.
- Keep `main` protected and merge only after each day gate is green.

---

## Day 1 - Stabilize Runtime and Environment Parity

### Objectives

1. Ensure local, Vercel, and VPS all have required env parity.
2. Ensure production Supabase project has all migrations (including RLS migration `20260423`).
3. Ensure ClaimVault signer key and on-chain `authorizedSigner` match.

### Checklist

- [ ] Confirm current release branch is up to date:
  - `git fetch origin && git checkout ai-verification && git pull origin ai-verification`
  - If `git push origin ai-verification` errors on a case-insensitive filesystem, use: `git push origin HEAD:ai-verification`
- [ ] Local env (`frontend/.env.local`) has:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`
  - `NEXT_PUBLIC_CLAIMVAULT_ADDRESS`
  - `PINATA_JWT`
- [ ] Supabase CLI points at the **same project** Vercel uses (one-time per machine):
  - `cd frontend && supabase link --project-ref <ref>` (ref from Supabase Dashboard → Project Settings)
  - Ensure `frontend/supabase/config.toml` exists (`cd frontend && supabase init` once if you only have `migrations/`). Then from repo root: `supabase migration list --workdir frontend`
  - **How to read the output:** each local file under `frontend/supabase/migrations/` appears with a timestamp/version. Rows applied to the linked remote show a migration label/time on the remote side; anything only on “local” and not on the remote still needs `supabase db push` (or your CI pipeline that applies migrations). For this app, the remote must include **`20260421`**, **`20260422`**, and **`20260423`** (RLS).
- [ ] ClaimVault signer alignment:
  - `cd frontend && npm run check:claimvault-signer`  
    (or Foundry: `cast wallet address --private-key $CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` and `cast call $NEXT_PUBLIC_CLAIMVAULT_ADDRESS "authorizedSigner()(address)" --rpc-url $NEXT_PUBLIC_SEPOLIA_RPC_URL`)
- [ ] Vercel env parity (Production + Preview as needed) and redeploy

### Day 1 Gate (must be true)

- No `503 Claim signing not configured`
- No Supabase RLS write failures on hypercert/verifier APIs
- ClaimVault signer key and on-chain signer are aligned

---

## Day 2 - Full Functional Testing in Deployed Environments

### Objectives

1. Validate Web3Auth on real deployed URL.
2. Validate AI path in VPS/VPN environment.
3. Validate hypercert and verifier end-to-end flow.

### Checklist

- [ ] Web3Auth test on deployed domain (not localhost):
  - login works
  - wallet session persists
  - no network mismatch errors
- [ ] AI service test from runtime that can access VPN/model:
  - submission reaches model service
  - expected response consumed by app
  - if model unavailable, app handles gracefully (manual review path / clear error)
- [ ] Hypercert flow:
  - submit request -> appears in list
  - review approve -> status approved
  - mint from approved -> status minted
- [ ] cDCU claim route:
  - request returns eligibility or signature payload (not config/signer errors)

### Day 2 Gate (must be true)

- Core user journeys pass on deployed infrastructure
- External dependencies (Web3Auth + AI) are validated in their real network contexts

---

## Day 3 - Mainnet Cutover and Monitoring

### Objectives

1. Deploy mainnet contract/env configuration.
2. Perform immediate post-cutover verification.
3. Keep rollback path ready.

### Checklist

- [ ] Prepare final release commit on `ai-verification`
- [ ] Open PR `ai-verification -> main`
- [ ] Merge after approvals/checks
- [ ] Deploy mainnet env values and app
- [ ] Run post-deploy smoke tests:
  - wallet connect
  - cleanup flow
  - verifier approval flow
  - hypercert request/review/mint
  - claim request route
- [ ] Monitor logs/errors for first launch window

### Day 3 Gate (must be true)

- Mainnet app is healthy and core actions succeed for at least one full journey.

---

## VPS Sync Details (What, When, Why)

If any API/service is hosted on VPS (or needs VPN reachability), you must sync code and env there whenever those routes change.

### You must sync VPS when:

- API route logic changed (e.g., signer, Supabase server key usage, verification paths).
- Environment variables changed for runtime APIs.
- AI integration behavior changed and model access depends on VPS network.

### VPS Sync Procedure

1. Pull latest release commit on VPS.
2. Install/update dependencies.
3. Build app (if required by your process).
4. Update env vars on VPS.
5. Restart process with env refresh (`pm2 restart <app> --update-env`).
6. Run endpoint checks from VPS runtime.

### Important

- Vercel env changes do not update VPS.
- VPS env changes do not update Vercel.
- Treat them as separate runtimes and keep a parity checklist.

---

## Git Branch Strategy (When to Push to Main)

### Recommended flow

1. Work only on `ai-verification` during launch prep.
2. Push small tested commits daily to `origin/ai-verification`.
3. Merge to `main` only at a gate:
   - after Day 1 gate (infra parity), and/or
   - after Day 2 gate (full functional pass), depending on your release policy.
4. Final launch merge: `ai-verification -> main` before Day 3 cutover.

### Practical rule

- Do not push unvalidated external-integration changes directly to `main`.
- `main` should represent "ready to deploy", not "in progress".

---

## Required Variables by Runtime

### Public/runtime-safe (`NEXT_PUBLIC_*`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- chain + contract addresses (`NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_CLAIMVAULT_ADDRESS`, etc.)

### Server-only secrets (never `NEXT_PUBLIC_*`)

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`
- `PINATA_JWT`
- optional: `CLAIM_VAULT_UNLOCK_SECRET`

---

## Final Note

If any secret was ever set under `NEXT_PUBLIC_*`, rotate it immediately and redeploy.
