# DeCleanup Network - Celo MVP

🌍 **Website**: [decleanup.net](https://decleanup.net)

DeCleanup Network's Celo-native stack for turning verified cleanups into onchain **Impact Products** and token rewards.  
This repository contains the complete smart contract infrastructure and frontend application for the DeCleanup Network MVP on Celo Sepolia testnet.

## 🎯 Milestone: Core Contracts Deployment (Testnet) & Hypercerts MVP

This milestone delivers the core infrastructure for DeCleanup Network, including deployment of smart contracts and integration of the cleanup submission mechanism. **Note**: Hypercerts integration has been intentionally postponed for future work once rewards and submissions are fully stable. The frontend includes helper code for image generation and metadata, but Hypercert minting is not wired into the live flow.

### ✅ Completed

- **Smart Contracts Deployed & Verified on Celo Sepolia**:
  - `DCUToken` (ERC20) - `0xa282c26245d116aB5600fBF7901f2E4827c16B7A`
  - `ImpactProductNFT` (ERC721) - `0x97448790fd64dd36504d7f5ce7c2d27794b01959`
  - `DCURewardManager` - `0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a`
  - `Submission` - `0x1e355123f9dec3939552d80ad1a24175fd10688f`

- **Frontend Application**: Next.js 16 + shadcn UI with responsive dashboard, verifier cabinet, leaderboard, and cleanup submission flow
- **Impact Reporting**: Optional impact data forms (weight/area/time/waste types) stored on IPFS
- **Recyclables step**: Optional recyclables (photo + receipt); 5 DCU in same bucket as impact form (no separate contract)
- **Test Coverage**: Comprehensive unit tests for all core contracts
- **Documentation**: Complete system architecture and deployment documentation

### 📋 What's Ready

- **Frontend** – Next.js 16 + shadcn UI with compact dashboard layout, verifier cabinet entry point, leaderboard link, and CTA flow tuned for tablets/desktop. All critical components (stats, Impact Product, actions, invites, verifier tools) are wired up.
- **Impact + recyclables** – Cleanup flow includes optional impact form and optional recyclables step (photo + receipt). When either is present, `Submission.sol` calls `rewardImpactReports(submitter, 1)` once (5 DCU per submission). DCU points count toward the multiplier and $cDCU is claimed later.
- **Contracts deployed** – Core contracts (`Submission`, `DCURewardManager`, `ImpactProductNFT`, `DCUToken`) are deployed and verified on Celo Sepolia with proper role setup and treasury configuration.

## Repo layout

```
contracts/      # Hardhat project (Solidity, tests, Ignition module, scripts)
frontend/       # Next.js 16 app, wagmi config, dashboard/profile/cleanup flows
docs/           # High-level docs for architecture, hypercerts, deployment
+ README.md     # You are here
```

## Local setup

```bash
# install deps
cd frontend && npm install
cd ../contracts && npm install

# run web app
cd ../frontend && npm run dev  # http://localhost:3000

# run hardhat tests
cd ../contracts && npx hardhat test
```

### Environment variables

Copy `frontend/ENV_TEMPLATE.md` → `frontend/.env.local` and fill the values (Chain ID, RPCs, WalletConnect ID, contract addresses, Pinata keys, Hypercerts network). For **$cDCU** and **deploy**, see **`docs/ENV_CDCU_AND_DEPLOY.md`** for which vars go in frontend vs root `.env`.  
For contracts, create a **root `.env`** (Hardhat loads it from project root) with `PRIVATE_KEY`, RPC URLs, and optionally `CELOSCAN_API_KEY` for verification.

## 📚 Documentation
- **[Development Specs](https://github.com/DeCleanup-Network/decleanup-main-celo/blob/main/docs/DEVELOPER_SPECS.md)** - 

## 🚀 Deployment Status

- ✅ **Contracts deployed & verified** on Celo Sepolia testnet
- ✅ **Contracts audited** for reentrancy/access control (see `docs/system-architecture.md`)
- ✅ **Role setup script** (`contracts/scripts/setup-roles.ts`) assigns treasury + verifier/admin roles
- ✅ **Frontend wired** to deployed contract ABIs (cleanup submission, verification, reward claiming, Impact Product minting)
- ✅ **Test coverage** for all core contract functionality

## 🔗 Links

- **Website**: [decleanup.net](https://decleanup.net)
- **Testnet Explorer**: [Celo Sepolia Blockscout](https://celo-sepolia.blockscout.com/)
- **Contract Addresses**: See `contracts/scripts/deployed_addresses.json`

---

Happy cleaning 🌍
