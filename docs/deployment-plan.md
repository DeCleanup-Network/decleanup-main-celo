# Deployment Plan (Celo)

This summarizes what’s left before launching `decleanup-main-celo`.

## 1. Prerequisites

- **Accounts**
  - Community wallet `decleanupnet.eth` (`0x173d87d...b4`) – holds 5000 cRECY reserve.
  - Main deployer/admin `0x520e40e346ea85d72661fce3ba3f81cb2c560d84` – receives fees/treasury.
  - Verifier wallet `0x7d85f...0bf95` – gets ADMIN_ROLE in `Submission`.
- **APIs**
  - WalletConnect Project ID.
  - Pinata API key/secret (server-side env).
  - Optional: BigDataCloud API key for leaderboard geocoding.

## 2. Contract deployment order (Ignition `DCUContracts.ts`)

**Current deployment (Celo Sepolia):**

1. `DCUToken` - ERC20 token with minter role
2. `DCURewardManager` - Reward distribution manager (initially with placeholder NFT address)
3. `ImpactProductNFT` - ERC721 NFT contract
4. `Submission` - Cleanup submission and verification contract
5. `RecyclablesReward` - Deployed separately (see `contracts/scripts/`)

> Run `npx hardhat test` first. Then `npx hardhat ignition deploy ./ignition/modules/DCUContracts.ts --network celoSepolia`.

## 3. Post-deploy script

Run `npx hardhat run scripts/setup-roles.ts --network celo-sepolia` with updated `deployed_addresses.json`. It will:

- Transfer ownership of Submission + DCURewardManager to main deployer.
- Grant DEFAULT_ADMIN_ROLE + ADMIN_ROLE to main deployer.
- Grant ADMIN_ROLE to verifier wallet.
- Update both treasuries to main deployer.
- Wire `RecyclablesReward` address into Submission.

## 4. Environment variables

- Update `frontend/.env.local` with deployed addresses:
  ```
  NEXT_PUBLIC_VERIFICATION_CONTRACT=<Submission>
  NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=<ImpactProductNFT>
  NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=<DCURewardManager>
  NEXT_PUBLIC_RECYCLABLES_REWARD_CONTRACT=<RecyclablesReward>
  ```
- Set RPC + chain IDs (Celo mainnet or Celo Sepolia).
- For contracts, add explorer API key to `contracts/.env` if verifying on CeloScan.

## 5. Verification & testing

- **Contract Verification**: Use `npx hardhat run scripts/verify-contracts.ts --network celoSepolia` or verify manually on [Celoscan](https://celoscan.io/)
- **Frontend smoke test**:
  - Wallet connect/disconnect
  - Submit cleanup (with photos + optional impact data) → ensure Submission tx + IPFS upload succeed
  - Approve via verifier cabinet (or script) → check rewards available
  - Mint Impact Product + claim level
  - Submit recyclables → ensure cRECY tracking (note: RecyclablesReward disabled on testnet)

## 6. Go-live checklist

- [ ] Run Lighthouse/Performance audit on dashboard.
- [ ] Confirm Pinata limits are sufficient (or swap to Web3.Storage fallback).
- [ ] Fund Submission contract with CELO for refunding fees (if feeEnabled).
- [ ] Double-check `.gitignore` excludes `.env`, build artifacts, node_modules.
- [ ] Update README with final deployed addresses once live.

## 7. Optional enhancements post-launch

- Background worker to auto-claim Hypercert rewards once mint event detected.
- Cached leaderboard backend to reduce geocoding calls.
- Additional docs for verifier onboarding & equipment reimbursement program.

