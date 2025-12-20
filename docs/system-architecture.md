# System Architecture (decleanup-main-celo)

## High-level flow

```
[User Wallet] ──wagmi/walletconnect──▶ [Next.js Frontend] ──RPC (viem)──▶ [Celo Contracts]
       │                                        │
       │                                        ├─ IPFS uploads (Pinata REST proxy)
       │                                        ├─ Hypercerts SDK (mintClaim)
       │                                        ├─ Geocoding API (leaderboard country resolution)
       │                                        └─ Local image generation (canvas → IPFS)
       │
       └── receives signatures, tx prompts, and minted rewards back
```

### Frontend layers
- **Next.js 16 App Router** with shadcn components and Tailwind for the dashboard/profile/cleanup flows.
- **State + data hooks** (`useIsVerifier`, `useHypercerts`, wagmi `useAccount`) feed stats cards, actions, and modals.
- **Libs**:
  - `lib/blockchain/contracts.ts` wraps viem contract reads/writes (cleanups, rewards, eligibility, recyclables).
  - `lib/blockchain/hypercerts-*.ts` handles aggregation, metadata generation, IPFS uploads, Hypercert mint, and reward claim.
  - `lib/utils/hypercert-image-generator.ts` builds collage/logo/banner images in-browser before uploading to IPFS.
  - `app/api/ipfs/upload` proxies Pinata uploads server-side so API keys stay private.

### Smart contracts (Deployed on Celo Sepolia)

- `DCUToken.sol` (ERC20) – `0xa282c26245d116aB5600fBF7901f2E4827c16B7A` – Main reward token with minter role for DCURewardManager
- `ImpactProductNFT.sol` (ERC721) – `0x97448790fd64dd36504d7f5ce7c2d27794b01959` – Dynamic Impact Product NFTs that level up based on verified cleanups
- `DCURewardManager.sol` – `0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a` – Accrues DCU rewards for impact claims, streaks, referrals, impact reports, verifiers, and recyclables. Users claim aggregated balances when ready.
- `Submission.sol` – `0x1e355123f9dec3939552d80ad1a24175fd10688f` – Receives cleanup submissions, stores IPFS hashes, approval status, location, impact/recyclables metadata, assigns rewards, and tracks verification workflow
- `RecyclablesReward.sol` – `0xf8f9db39f83ea40d4f9aca72cdbec74b8f5a2900` – cRECY ERC20 reserve (5000 limit) that `Submission` calls once per eligible cleanup (disabled on testnet, uses mainnet cRecyToken address)

### Hypercert workflow (Future Implementation)

**Note**: Hypercerts integration has been intentionally postponed for future work. The frontend includes helper code for image generation and metadata, but Hypercert minting is not wired into the live flow.

Planned workflow (when implemented):
1. User reaches 10 verified cleanups (Submission increments `userHypercertCount`).
2. Frontend fetches the last 10 cleanups, pulls impact reports from IPFS, and aggregates stats (weight, area, hours, waste types, contributors).
3. Canvas utility builds collage/banner/logo → uploads to IPFS.
4. Metadata JSON (with aggregated stats + IPFS media) uploads to IPFS.
5. Hypercert SDK `mintClaim` on Celo (FromCreatorOnly restriction).
6. On success we call `claimHypercertReward(hypercertNumber)` to grant the 10 $DCU bonus.

### Recyclables + Impact Reports
- **Impact form**: optional after photos. Stored as JSON on IPFS (`impactFormDataHash`). Submission increments `userImpactFormCount` and rewards extra DCU via `rewardImpactReports`.
- **Recyclables**: optional step with photo + receipt hash. Submission stores `hasRecyclables`, and on approval call `RecyclablesReward.rewardRecyclables` (5 cRECY per submission, respecting 5000 cRECY cap).

### Data sources
| Source            | Role |
| ----------------- | ---- |
| Pinata IPFS       | Photos, impact forms, hypercert-generated assets + metadata |
| Hypercerts SDK    | Claim minting on Celo (ERC-1155) |
| Celo RPC          | Contract reads/writes (Submission, RewardManager, ImpactProductNFT, RecyclablesReward) |
| BigDataCloud API  | Reverse geocode lat/lng to country for leaderboard |

## Dev/test paths
- `frontend`: `npm run dev` (Next.js), `npm run build`, `npm run test`.
- `contracts`: `npx hardhat test`, `npx hardhat run scripts/setup-roles.ts --network celoSepolia`.
- `contracts/ignition/modules/DCUContracts.ts` defines the deployment graph (DCUToken → DCURewardManager → ImpactProductNFT → Submission).

## Pending improvements
- Fine-tune dashboard spacing once real data is live.
- Add cached leaderboard endpoint (optional) if geocoding API quotas become tight.
- Automate Hypercert reward claim in backend listener (optional; currently user-triggered after mint).

