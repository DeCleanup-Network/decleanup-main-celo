# Hypercerts (impact certificates)

**Last reviewed:** April 2026

Eligible users can mint **Hypercerts** on Celo using aggregated cleanup + impact data, IPFS-hosted images/metadata, and the Hypercerts minter contract configured in **`frontend/src/lib/blockchain/hypercerts/config.ts`**.

## Code map

| Topic | Location |
|--------|-----------|
| Eligibility | `frontend/src/lib/blockchain/hypercerts/eligibility.ts`, `config.ts` |
| Aggregation / metadata | `frontend/src/lib/blockchain/hypercerts/aggregation.ts`, `metadata.ts` |
| Mint + IPFS | `frontend/src/lib/blockchain/hypercerts-minting.ts` |
| UX | `frontend/src/app/page.tsx`, `frontend/src/app/create-hypercert/page.tsx`, `frontend/src/app/hypercerts/page.tsx` |
| On-chain bonus | `DCURewardManager.claimHypercertReward` (DCU ledger bonus; see contract `hypercertBonus`) |

Product narrative: **`docs/hypercerts-and-impact.md`**.
