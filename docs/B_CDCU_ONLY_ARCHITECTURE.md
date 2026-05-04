# DCU ledger vs `$cDCU` (ClaimVault)

## Roles

| Piece | Role |
|--------|------|
| **DCURewardManager** | On-chain **DCU participation ledger** (`totalEarned`, per-source buckets). **Does not mint** `$cDCU`. |
| **CDCUToken (`$cDCU`)** | ERC-20; **only ClaimVault** may `mint`. |
| **ClaimVault** | Validates **EIP-712** signatures from your **authorized backend signer**, category caps, nonce; then mints. |

Legacy **DCUToken** “claim to ERC-20” flows are **not** part of the active MVP path.

## Deploy artifacts

After deploy, use **`contracts/scripts/deployed_addresses.json`** for `Submission`, `DCURewardManager`, `ImpactProductNFT`, `CDCUToken`, `ClaimVault`, and `network` / `chainId`.

## `$cDCU` claim math (app today)

Server-side logic lives in **`frontend/src/lib/cdcu/claim-signing.ts`** (read with `DCURewardManager.getUserRewardStats`):

- **Eligibility:** at least **50** DCU points (`totalEarned` scale 1e18).
- **Progressive multiplier:** from **1.1** at 50 points, **+0.1 per extra 50** points, **capped at 2.0**.
- **Cap from points:** `claimableCapFromPoints(total)` ≈ `totalPoints × multiplier` (see code).
- **Per-claim slice:** users claim **one 50-DCU tranche at a time** (`incrementalClaimWei`); issued amounts are tracked server-side so users cannot double-mint.

Dashboard **`$cDCU`** mints use ClaimVault category **`CleanupCampaign` (1)** unless you change signing policy.

## Deploy commands (summary)

From repo root with `.env` funded deployer:

```bash
CONFIRM_DEPLOY_CORE_STACK=YES npx hardhat run contracts/scripts/deploy-core-stack.ts --network celoSepolia
AUTHORIZED_SIGNER_ADDRESS=0xYourSignerPub npx hardhat run contracts/scripts/deploy-cdcu.ts --network celoSepolia
npx hardhat run contracts/scripts/setup-roles.ts --network celoSepolia
```

See **`contracts/scripts/README-FEE-SCHEDULING.md`** for fee-related scripts.
