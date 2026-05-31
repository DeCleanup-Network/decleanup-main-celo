# DeCleanup Network - Celo MVP

**Website:** [decleanup.net](https://decleanup.net) · **Dapp:** [dapp.decleanup.net](https://dapp.decleanup.net)

Celo mainnet stack for verified cleanups → onchain **Impact Products**, **DCU** participation points, optional **Hypercerts**, and **`$cDCU`** (minted via **ClaimVault** signed claims).

## What's in the repo

| Path | Contents |
|------|----------|
| `contracts/` | Hardhat: Submission, DCURewardManager, ImpactProductNFT, CDCUToken, ClaimVault |
| `frontend/` | Next.js app (dashboard, cleanup, verifier, APIs, Supabase) |
| `gpu-inference-service/` | Optional YOLOv8 worker for ML pre-screening |
| `docs/` | Architecture, deployment, VPS, ML, public API |
| `scripts/vps/` | Deploy and harden VPS (PM2, Nginx, GPU) |

**Deployed addresses:** `contracts/scripts/deployed_addresses.json` → wire into `NEXT_PUBLIC_*` env vars.

## Local setup

```bash
cd frontend && npm install && npm run dev    # http://localhost:3000
cd ../contracts && npm install && npx hardhat test
```

Copy **`frontend/ENV_TEMPLATE.md`** → `frontend/.env.local`. For mainnet local testing set `NEXT_PUBLIC_CHAIN_ID=42220` and addresses from `deployed_addresses.json`.

## Documentation

| Doc | Topic |
|-----|--------|
| [`docs/README.md`](docs/README.md) | Full index |
| [`docs/system-architecture.md`](docs/system-architecture.md) | End-to-end architecture |
| [`docs/deployment-plan.md`](docs/deployment-plan.md) | Vercel / mainnet release checklist |
| [`docs/VPS_DEPLOYMENT.md`](docs/VPS_DEPLOYMENT.md) | VPS + ML enablement |
| [`docs/PUBLIC_IMPACT_API.md`](docs/PUBLIC_IMPACT_API.md) | Landing page feed API |
| [`docs/B_CDCU_ONLY_ARCHITECTURE.md`](docs/B_CDCU_ONLY_ARCHITECTURE.md) | DCU vs `$cDCU`, ClaimVault |

## Links

- [CeloScan (mainnet)](https://celoscan.io/)
- [Tokenomics](https://decleanup.net/tokenomics)
- Legal: `/terms`, `/privacy` (source in `docs/`)
