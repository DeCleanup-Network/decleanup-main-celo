# DeCleanup Network - Celo MVP

**Website:** [decleanup.net](https://decleanup.net)

Celo-native stack for verified cleanups → onchain **Impact Products**, **DCU** participation points, optional **Hypercerts**, and **`$cDCU`** (minted via **ClaimVault** signed claims). This repo is the contracts + Next.js app used for testnet and staging work.

## What’s in the repo

| Path | Contents |
|------|----------|
| `contracts/` | Hardhat: `Submission`, `DCURewardManager`, `ImpactProductNFT`, `CDCUToken`, `ClaimVault`, scripts, tests |
| `frontend/` | Next.js app (dashboard, cleanup, verifier flows, APIs, Supabase clients) |
| `docs/` | Architecture, token/$cDCU notes, deployment, security, ML verify, Hypercerts |
| `gpu-inference-service/` | Optional GPU worker for ML-assisted verification |

**Deployed addresses (current Sepolia deploy):** `contracts/scripts/deployed_addresses.json` - always treat this file as source of truth when wiring `NEXT_PUBLIC_*` variables.

## Local setup

```bash
cd frontend && npm install && npm run dev    # http://localhost:3000
cd ../contracts && npm install && npx hardhat test
```

### Environment

- Copy **`frontend/ENV_TEMPLATE.md`** → `frontend/.env.local` and fill RPC, WalletConnect, contract addresses, Pinata, ClaimVault signer, optional Supabase.
- **`$cDCU` / ClaimVault / deploy commands:** **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**
- Root **`.env`** for Hardhat (`PRIVATE_KEY`, RPC, explorer API key for verify).

## Documentation index

- **`docs/system-architecture.md`** - end-to-end diagram and components
- **`docs/B_CDCU_ONLY_ARCHITECTURE.md`** - DCU ledger vs `$cDCU`, ClaimVault, deploy
- **`docs/HYPERCERTS.md`** - Hypercerts implementation overview
- **`docs/hypercerts-and-impact.md`** - impact data → certificate pipeline
- **`docs/deployment-plan.md`** - release checklist
- **`docs/TOKEN_SPEC.md`** - tokenomics, ClaimVault, governance threshold
- **`docs/VPS_*.md`** - optional VPS / hardening / post-deploy

## Links

- [Celo Sepolia Blockscout](https://celo-sepolia.blockscout.com/)
- [Tokenomics](https://decleanup.net/tokenomics)
- Legal (in-app when running the frontend): `/terms`, `/privacy` - full markdown in `docs/TERMS_OF_SERVICE.md` and `docs/PRIVACY_POLICY.md`

---

Happy cleaning
