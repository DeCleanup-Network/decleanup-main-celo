# DeCleanup smart contracts (Hardhat)

Solidity contracts for **Submission**, **DCURewardManager** (DCU participation ledger), **ImpactProductNFT**, **`$cDCU` (`CDCUToken`)**, and **ClaimVault** (signed mint gate).

## Docs

- Deploy / token model: **`../docs/B_CDCU_ONLY_ARCHITECTURE.md`**
- Architecture overview: **`../docs/system-architecture.md`**
- Fee scheduling script notes: **`scripts/README-FEE-SCHEDULING.md`**

## Commands

```bash
npm install
npx hardhat test
```

Deploy and role scripts live under **`scripts/`**. After deploy, **`scripts/deployed_addresses.json`** is the canonical address list for the frontend.

## Legacy note

Older marketing docs referred to a separate **`DCUToken`** reward ERC-20. The active MVP path uses **DCU points on `DCURewardManager`** plus **`$cDCU`** minted only through **ClaimVault** - see **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**.
