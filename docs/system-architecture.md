# System architecture (DeCleanup Rewards / Celo MVP)

## High-level flow

```
[User] ──▶ Sign-in (Google/email via Auth.js OR MetaMask / WalletConnect via wagmi)
              │
              ├─ Embedded path: EOA in browser + Safe smart account (ERC-4337) + optional passkey unlock
              └─ External path: user wallet signs txs / messages directly
              │
              ▼
[Next.js frontend] ──viem RPC──▶ [Celo contracts]
       │                │
       │                ├─ Pimlico bundler + paymaster (gasless UserOps for embedded users)
       │                ├─ IPFS uploads (Pinata via `app/api/ipfs/upload`)
       │                ├─ Hypercerts minter + SDK (`lib/blockchain/hypercerts*`)
       │                ├─ Optional ML verify / GPU service (see `docs/ML_VERIFICATION_ARCHITECTURE.md`)
       │                └─ Supabase (verifier applications, Hypercert requests, impact portfolios, airdrop claim state)
       │
       └── signatures, UserOps, DCU ledger updates, $cDCU mints (ClaimVault), past-contributor airdrop
```

### Frontend

- **Next.js** (App Router) + Tailwind + shadcn-style components.
- **Auth.js (NextAuth)** when `NEXT_PUBLIC_AA_AUTH_ENABLED=true`: Google OAuth and email magic links; session gates dashboard and wallet APIs.
- **Wagmi / viem** for onchain reads and external-wallet writes.
- **Account abstraction (embedded users)**
  - Client EOA created or restored in-browser (`lib/client-wallet/*`).
  - **Safe** smart account predicted and deployed on first sponsored tx (`lib/smart-account/*`).
  - **Passkey** optional for unlock (`app/api/passkey/*`, WebAuthn).
  - **Pimlico** bundler + paymaster for sponsored UserOperations (`lib/paymaster/pimlico.ts`).
- **Key libraries**
  - `frontend/src/lib/blockchain/contracts.ts` — Submission, rewards, Impact Product, ClaimVault reads.
  - `frontend/src/lib/blockchain/claim-vault.ts` — signed `$cDCU` claims and airdrop claims.
  - `frontend/src/lib/airdrop/*` — manual allocation list, EIP-712 claim requests, pending-claim store.
  - `frontend/src/lib/blockchain/hypercerts-*` — eligibility, aggregation, minting, IPFS.
  - `frontend/src/lib/server/*` — API guards, rate limits, verifier checks where applicable.

### Smart contracts (source of truth: `contracts/scripts/deployed_addresses.json`)

Typical **Celo mainnet** deploy (chain ID `42220`; see `contracts/scripts/deployed_addresses.json`):

| Contract | Role |
|----------|------|
| **Submission** | Cleanup lifecycle, IPFS hashes, verifier approve/reject, DCU accrual triggers, Hypercert eligibility signals. |
| **DCURewardManager** | On-chain **DCU participation ledger** (`totalEarned`, buckets). Does **not** mint ERC-20 reward tokens. |
| **ImpactProductNFT** | Impact Product levels from verified cleanups. |
| **CDCUToken (`$cDCU`)** | ERC-20 **minted only by ClaimVault** (governance + claims). |
| **ClaimVault** | Validates EIP-712 signatures from your backend signer; enforces category caps; calls `CDCUToken.mint`. |

Legacy **`DCUToken`** flows were removed; participation points accrue in **DCURewardManager** and convert to **`$cDCU`** through **ClaimVault** claims. See **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**.

### Authentication and wallets

| Mode | Sign-in | Onchain identity | Gas |
|------|---------|------------------|-----|
| **Embedded (recommended)** | Google or email | Safe smart account (submission owner) | Sponsored via Pimlico when configured |
| **External** | MetaMask / WalletConnect | Connected EOA (may link to Safe for legacy users) | User pays CELO |

Settings and recovery: **`/wallet`** (smart account settings). User-facing walkthrough: **`/guide`**.

### Hypercerts

Implemented end-to-end for eligible users (metadata → IPFS → minter contract). Overview: **`docs/HYPERCERTS.md`**. Product pipeline: **`docs/hypercerts-and-impact.md`**.

Both embedded and external users can open **`/hypercerts`** when signed in; eligibility reads use the **submission owner** address (smart account for embedded users).

### Recyclables + impact reports

- Optional **impact form** and **recyclables** (photo / receipt) on cleanup; data on IPFS.
- On approval, **Submission** awards the shared impact bucket via **`rewardImpactReports`** (same 5 DCU path for report and/or recyclables — no separate recyclables ERC-20 in this stack).

### Data sources

| Source | Role |
|--------|------|
| Pinata (via API route) | Photos, forms, Hypercert assets + metadata |
| Celo RPC | Contract reads/writes |
| Supabase | Verifier applications, Hypercert requests, impact portfolio, cleanup feed, airdrop state (`frontend/supabase/migrations/`) |
| Prisma (optional) | Passkey credentials, wallet metadata when AA auth enabled |
| Optional geocoding | Leaderboard country resolution |
| VPS `UPLOAD_DIR` (optional) | ML pre-screening photo cache when `ML_VERIFICATION_ENABLED=true` |

## Dev commands

- Frontend: `cd frontend && npm run dev` / `npm run build`
- Contracts: `cd contracts && npx hardhat test`
- Deploy / roles: `docs/B_CDCU_ONLY_ARCHITECTURE.md`, `contracts/scripts/README-FEE-SCHEDULING.md` as needed

## Maintenance notes

- Prefer **`contracts/scripts/deployed_addresses.json`** over hardcoding addresses in docs.
- **`docs/deployment-plan.md`** — Vercel / mainnet release checklist.
- **`docs/VPS_DEPLOYMENT.md`** — VPS, PM2, ML enablement.
- Auth: **Auth.js** (Google/email) + embedded Safe smart accounts; external MetaMask/WalletConnect. Do not use custodial key storage.
