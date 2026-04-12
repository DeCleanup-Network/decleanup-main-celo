# Mainnet readiness + verifier grantRole roadmap

This document consolidates:

- **Branch and PR expectations** (work on `ai-verification`, merge to `main` when the flow is done and tested).
- **The verifier approval + `grantRole` pipeline** your dev specified (`init` → on-chain tx → `confirm`).
- **Broader mainnet launch items** (contracts, persistence, E2E, ops) so one place tracks “what’s left.”

Related detail elsewhere: [`LAUNCH_EXECUTION_PLAN.md`](../LAUNCH_EXECUTION_PLAN.md), [`docs/deployment-plan.md`](deployment-plan.md), [`docs/AIRDROP.md`](AIRDROP.md), [`docs/HYPERCERTS_STATUS.md`](HYPERCERTS_STATUS.md).

---

## Git: branch, commits, PR

- **Active branch:** `ai-verification` — `git checkout ai-verification` and `git pull origin ai-verification` before starting.
- **Secrets:** Keep `frontend/.env.local` out of git (BigDataCloud, Supabase, RPC on their own lines).
- **Commits:** Use clear messages; **optional but good:** put unrelated work (VPS scripts, docs, rate limits) in **separate commits** so the verifier PR stays reviewable.
- **When ready:** `git push origin ai-verification` and open **PR: `ai-verification` → `main`** after tests pass and on-chain/DB invariants hold.

---

## Part A — Verifier approval + `grantRole` (required for mainnet trust)

**Goal:** No database row reaches `APPROVED` until the chain proves `VERIFIER_ROLE` (or equivalent). Flow: **`POST .../init`** (pending on-chain) → **wallet `grantRole`** → **`POST .../confirm`** (verify receipt + `hasRole`, then `APPROVED`).

### 1) Baseline (once)

1. `git checkout ai-verification` and `git pull origin ai-verification`.
2. Place `frontend/.env.local` with fixed formatting (BigDataCloud / Supabase each on their own line). **Do not commit it.**
3. `cd frontend && npm install && npm run dev` — app runs locally with Supabase + RPC.

### 2) Database / types (if needed)

- In **Supabase**, ensure `verifier_applications.status` (or equivalent) can represent **`APPROVAL_PENDING_ONCHAIN`** (or your chosen name). Add migration / enum update if the column is only `PENDING | APPROVED | REJECTED`.
- Regenerate or update **`database.types.ts`** / mappers in `frontend/src/lib/supabase/` so the new status is typed end-to-end.

### 3) Backend: `POST /api/verifier/review/init`

- **Auth:** Same admin check as today (on-chain `ADMIN_ROLE` / whatever `admin-check` does).
- **Body:** e.g. `{ applicationId }` (match existing Zod patterns).
- **Behavior:**
  - Load application; acquire lock (reuse existing atomic lock).
  - If not eligible for approval (wrong state, etc.) → error, release lock.
  - Set status → **`APPROVAL_PENDING_ONCHAIN`** (not `APPROVED`).
  - Audit log entry: e.g. `approval_initiated`.
  - Return `{ readyForGrant: true, applicationId, applicantAddress, ... }` for the frontend to call `grantRole`.
- **Invariant:** Still **no `APPROVED` in DB** at this step.

### 4) Backend: `POST /api/verifier/review/confirm`

- **Body:** `{ applicationId, txHash }`.
- **Auth:** Admin again.
- **Behavior:**
  - Load + lock application; require status **`APPROVAL_PENDING_ONCHAIN`** (or reject).
  - Fetch receipt for `txHash` on **Celo Sepolia** (then mainnet when switched); confirm success.
  - On-chain check: **`hasRole(VERIFIER_ROLE, applicant)`** — must be true after that tx (parse logs if you need to be strict).
  - Only then: set DB → **`APPROVED`**, store `tx_hash`, audit log `approval_confirmed`, unlock.
  - If anything fails → **do not** set `APPROVED`; unlock and leave status recoverable (e.g. back to `PENDING` or stay pending-onchain with a clear code). Per dev: release lock, keep status pending.
- **Invariant:** **No path** where DB says `APPROVED` unless the chain proves the role.

### 5) Tighten / replace old `POST /api/verifier/review`

- Remove or hard-guard any path that sets **`APPROVED`** without going through **init → tx → confirm**.
- If one route must remain for backwards compatibility, route it through the same internal pipeline or return **410 / deprecated** in production.

### 6) Frontend: split “Approve”

1. `POST .../init`
2. Call **`grantVerifierRole(applicant)`** (or equivalent in `contracts.ts`) with the **connected admin wallet**
3. Wait for transaction receipt
4. `POST .../confirm` with `{ applicationId, txHash }`
5. **Errors:** Show message; **do not** show “approved” until **confirm** succeeds.

### 7) Test on Celo Sepolia (before PR to `main`)

| Step | Check |
|------|--------|
| Apply as verifier | `PENDING` |
| Admin Approve | Wallet submits `grantRole` |
| After confirm | DB `APPROVED`, audit has tx hash |
| Explorer + contract | `hasRole` true for applicant |
| Deliberately fail tx | DB **must not** show `APPROVED` |

### 8) Git / PR (verifier feature)

- Commit on **`ai-verification`** with clear messages.
- `git push origin ai-verification`
- Open **PR: `ai-verification` → `main`** when tests pass and the invariant holds.

### 9) Optional housekeeping

- Commit local uncommitted work (VPS scripts, docs, rate limits) in **separate commits** so the verifier PR stays reviewable.

**Summary:** `init` (pending on-chain) → wallet `grantRole` → `confirm` (verify chain, then `APPROVED`). **No** old shortcut that approves in DB first.

---

## Part B — Broader mainnet readiness (consolidated)

Use this as the **launch checklist** alongside Part A. Items overlap with [`LAUNCH_EXECUTION_PLAN.md`](../LAUNCH_EXECUTION_PLAN.md).

### Blockers called out in the launch plan

1. **Celo mainnet contracts deployed** — Ignition deploy, verify on explorer, `setup-roles`, env updated.
2. **`grantRole` integrated securely** — Part A above.
3. **Persistent database** — Supabase (or equivalent) for verifier data and audit; no in-memory-only production state.
4. **Admin authentication enforced** — Server + on-chain alignment for privileged actions.
5. **E2E mainnet test passed** — Full user + verifier flow including Impact API and restart persistence.
6. **Governance / treasury** — As per token/governance design.
7. **Production documentation** — Architecture, contract flow, verifier guide, deployment checklist.

### Contracts and environment ([`docs/deployment-plan.md`](deployment-plan.md))

- [ ] `npx hardhat test` → deploy `DCUContracts` to **Celo mainnet** → verify → `setup-roles` with `deployed_addresses.json`
- [ ] Frontend: `NEXT_PUBLIC_VERIFICATION_CONTRACT`, NFT, reward manager, **`NEXT_PUBLIC_CHAIN_ID=42220`**, production RPC
- [ ] Fund Submission / fee refunds if required; Pinata (or fallback) capacity

### Full E2E sequence (launch plan)

1. User submits cleanup  
2. Admin approves cleanup on-chain  
3. User creates Hypercert request  
4. Admin approves Hypercert request  
5. User mints Hypercert  
6. User B applies as verifier  
7. Admin approves User B → **`grantRole`** (Part A)  
8. Confirm `VERIFIER_ROLE` on-chain  
9. User B verifies User A’s cleanup  
10. Impact API returns aggregated data  
11. Data persists after server restart  

### Airdrop (if shipping on mainnet) — [`docs/AIRDROP.md`](AIRDROP.md)

- Mainnet ClaimVault + token; dedicated signer in secrets; env and dry run; CSV/legal; backups; incident plan.

### Hypercerts hardening — [`docs/HYPERCERTS_STATUS.md`](HYPERCERTS_STATUS.md)

- E2E mint; IPFS reliability; monitoring; mainnet SDK/network verification as needed.

### Ops and security (cross-cutting)

- Rate limiting, validation, monitoring (e.g. Sentry), uptime checks  
- Web3Auth: `NEXT_PUBLIC_WEB3AUTH_NETWORK` must match the Web3Auth dashboard (Sapphire dev vs mainnet)

---

## Order of operations (suggested)

1. **Part A** on **Celo Sepolia** (invariants + tests).  
2. **PR `ai-verification` → `main`** when Part A is green.  
3. **Mainnet deploy + env flip** + Part B E2E on **42220**.  
4. Airdrop / governance / docs in parallel where they do not block the core loop.

---

*Last updated: consolidated from launch plan, deployment docs, airdrop checklist, and verifier grantRole steps.*
