# System architecture (DeCleanup Celo MVP)

## High-level flow

```
[User wallet] ──wagmi / WalletConnect──▶ [Next.js frontend] ──viem RPC──▶ [Celo contracts]
       │                                        │
       │                                        ├─ IPFS uploads (Pinata via `app/api/ipfs/upload`)
       │                                        ├─ Hypercerts minter + SDK (`lib/blockchain/hypercerts*`)
       │                                        ├─ Optional ML verify / GPU service (see `docs/ML_VERIFICATION_ARCHITECTURE.md`)
       │                                        └─ Supabase (verifier applications, Hypercert requests, impact portfolios)
       │
       └── signatures, tx prompts, DCU ledger updates, $cDCU mints (via ClaimVault)
```

### Frontend

- **Next.js** (App Router) + Tailwind + shadcn-style components.
- **Wagmi / viem** for reads and writes; Web3Auth configuration in `frontend/src/lib/web3auth/config.ts`.
- **Key libraries**
  - `frontend/src/lib/blockchain/contracts.ts` - Submission, rewards, Impact Product, ClaimVault reads.
  - `frontend/src/lib/blockchain/claim-vault.ts` - signed `$cDCU` claims.
  - `frontend/src/lib/blockchain/hypercerts-*` - eligibility, aggregation, minting, IPFS.
  - `frontend/src/lib/server/*` - API guards, rate limits, verifier checks where applicable.

### Smart contracts (source of truth: `contracts/scripts/deployed_addresses.json`)

Typical **Celo Sepolia** greenfield deploy (see JSON for live hexes):

| Contract | Role |
|----------|------|
| **Submission** | Cleanup lifecycle, IPFS hashes, verifier approve/reject, DCU accrual triggers, Hypercert eligibility signals. |
| **DCURewardManager** | On-chain **DCU participation ledger** (`totalEarned`, buckets). Does **not** mint ERC-20 reward tokens. |
| **ImpactProductNFT** | Impact Product levels from verified cleanups. |
| **CDCUToken (`$cDCU`)** | ERC-20 **minted only by ClaimVault** (governance + claims). |
| **ClaimVault** | Validates EIP-712 signatures from your backend signer; enforces category caps; calls `CDCUToken.mint`. |

Legacy **`DCUToken`** flows were removed; participation points accrue in **DCURewardManager** and convert to **`$cDCU`** through **ClaimVault** claims. See **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**.

### Hypercerts

Implemented end-to-end for eligible users (metadata → IPFS → minter contract). Overview: **`docs/HYPERCERTS.md`**. Product pipeline: **`docs/hypercerts-and-impact.md`**.

### Recyclables + impact reports

- Optional **impact form** and **recyclables** (photo / receipt) on cleanup; data on IPFS.
- On approval, **Submission** awards the shared impact bucket via **`rewardImpactReports`** (same 5 DCU path for report and/or recyclables - no separate recyclables ERC-20 in this stack).

### Data sources

| Source | Role |
|--------|------|
| Pinata (via API route) | Photos, forms, Hypercert assets + metadata |
| Celo RPC | Contract reads/writes |
| Supabase | Verifier applications, Hypercert request workflow, impact portfolio storage (see `frontend/supabase/migrations/`) |
| Optional geocoding | Leaderboard country resolution |

## Dev commands

- Frontend: `cd frontend && npm run dev` / `npm run build`
- Contracts: `cd contracts && npx hardhat test`
- Deploy / roles: `docs/B_CDCU_ONLY_ARCHITECTURE.md`, `contracts/scripts/README-FEE-SCHEDULING.md` as needed

## Maintenance notes

- Prefer **`contracts/scripts/deployed_addresses.json`** over hardcoding addresses in docs.
- **`docs/deployment-plan.md`** - operational checklist for releases.
