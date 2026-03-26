# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning.

---

## [$cDCU Claim UX, Unlock & Governance 250] – 2026-03

Claim flow fixes, simpler copy, unlock endpoint, and governance threshold set to 250 $cDCU.

### Deployed contracts (reference)

No contract redeploys in this release. Addresses below are from existing deployment artifacts (Celo Sepolia unless noted).

| Contract | Address | Source |
|----------|---------|--------|
| DCUToken | `0xa282c26245d116aB5600fBF7901f2E4827c16B7A` | deployed_addresses.json |
| DCURewardManager | `0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a` | deployed_addresses.json |
| Submission | `0x1e355123f9dec3939552d80ad1a24175fd10688f` | deployed_addresses.json |
| ImpactProductNFT | `0x97448790fd64dd36504d7f5ce7c2d27794b01959` | deployed_addresses.json |
| CDCUToken | `0x98bcb22234527bbcb11b6f1987b5202719302621` | cdcu-deployed.json |
| ClaimVault | `0x0c970ede1641a4c75458f8b1496b83f1ae33d879` | cdcu-deployed.json |

**Submission.sol and its mentions were not changed.** Same as dev: on approval, Submission already calls `rewardManager.rewardImpactReports(submitter, 1)` for both impact form and recyclables (separate blocks), so recyclables get +5 DCU on-chain without any contract change. DCU points are calculated and stored on-chain (DCURewardManager / DCUToken balance); the claim backend only **reads** that balance for eligibility and claimable amount. No redeploy of Submission required.

### Claim flow: record only on success

- **Problem:** Backend was marking the full claim amount as “issued” when returning the signed claim. If the user cancelled the wallet popup, the next request saw “No claimable $cDCU left.”
- **Fix:** Issued is recorded only after the user’s tx confirms. When we sign, we set a **pending** amount per recipient; claimable = cap − issued − pending.
- **frontend/src/lib/cdcu/claim-signing.ts** – Added `pendingKey`, `getPendingAmount`, `setPendingAmount`, `recordIssued`, `clearPending`, `resetIssuedAndPending`. Store holds both issued (on-chain confirmed) and pending (signed, not yet submitted) per address.
- **POST /api/cdcu/claim-request** – Sets pending when returning the signature; no longer adds to issued. Claimable computed as `claimableCapWei - totalIssued - pending`.
- **GET /api/cdcu/eligibility** – `claimableNow` subtracts pending so the UI shows correct remaining amount.
- **POST /api/cdcu/record-issued** – Body: `{ recipient, amount }`. Called by the frontend **after** `claimCdcu()` succeeds; moves pending → issued.
- **POST /api/cdcu/clear-pending** – Body: `{ recipient }`. Clears pending so the user can request a new signature (e.g. after cancelling the tx).
- **DashboardClaimCdcu** – After tx success, calls `record-issued`; on wallet cancel, calls `clear-pending` and shows “You cancelled the request.”

### Unlock (reset issued/pending)

- **POST /api/cdcu/unlock** – Body: `{ recipient, secret }`. Resets issued and pending for an address so they can claim again. Use when the claim tx failed or tokens never arrived but the backend had already recorded it. Requires `CLAIM_VAULT_UNLOCK_SECRET` in env; document in ENV_TEMPLATE.md.

### Claim card copy

- **DashboardClaimCdcu** – Replaced long line (“At X points you can claim up to Y $cDCU total — you already claimed… remaining”) with: **“Based on your DCU score you will receive X $cDCU.”** Button and disabled state unchanged.

### Governance threshold: 500 → 250 $cDCU

- **docs/TOKEN_SPEC.md** – Governance section and all references updated: minimum balance for voting and creating proposals is **250 $cDCU** (was 500). Table “1 to 499” → “1 to 249”, “500+” → “250+”; eligibility and Decisions table updated; changelog entry 1.4 added.
- **frontend/src/config/cdcu.ts** – New file with `GOVERNANCE_MIN_CDCU = 250` for UI and future governance checks.

---

## [$cDCU Claim Flow, Eligibility & Deployment] – 2026-03

This release adds the full **$cDCU mint-on-claim** flow: eligibility at 50 DCU points, a multiplier formula for claimable amount, backend signing API, frontend eligibility UI, and deployment script for CDCUToken + ClaimVault. **No contract logic changes** were required for eligibility or the formula—those live in the backend; contracts only verify EIP-712 and mint.

### Contracts (no logic changes)

- **CDCUToken.sol** – Unchanged. ERC-20, 10M cap, only ClaimVault can mint.
- **ClaimVault.sol** – Unchanged for eligibility. Already has: EIP-712 claim verification, category caps, 30-day max expiry (`MAX_CLAIM_EXPIRY_WINDOW`), one-time liquidity mint, signer rotation. Eligibility (50 points) and claimable amount formula are **off-chain** (backend).

### Deployment

- **contracts/scripts/deploy-cdcu.ts** – Deploys CDCUToken → ClaimVault(token, authorizedSigner) → setClaimVault(ClaimVault); optional transfer of ClaimVault ownership to multisig. Output: `contracts/scripts/cdcu-deployed.json`. Next-steps log updated (frontend env, backend env, eligibility doc ref).
- **Deployer vs signer:** The **deployer** wallet (e.g. `0x520e40e346ea85d72661fce3ba3f81cb2c560d84` from setup-roles) is used only to deploy and optionally transfer ownership. The **authorized signer** is a **separate** wallet (backend); its **private key** is only needed in backend env (`CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`). **The dev does not need the project owner’s deployer private key**—either the owner deploys and shares contract addresses + authorized signer address, or the dev deploys with a team/dev wallet and the owner provides only `AUTHORIZED_SIGNER_ADDRESS` (and keeps the signer key on their backend). See “For the dev” below.

### Backend (eligibility + signing)

- **frontend/src/lib/cdcu/claim-signing.ts** – Server-only:
  - `ELIGIBILITY_THRESHOLD_WEI = 50` DCU points; `claimableCapFromPoints(totalPointsWei)` = (points - 50) × 0.1 (wei).
  - `getClaimableAmountFromChain(recipient)` – Reads DCURewardManager `getUserRewardStats`, returns total points (cleanups + impact + referral + streak).
  - `getEligibilityAndClaimable(recipient)` – Returns `{ totalPointsWei, eligible, claimableCapWei }`.
  - EIP-712 signing for ClaimVault (domain + Claim type), file store for “already issued” per recipient.
- **POST /api/cdcu/claim-request** – Requires 50+ DCU points; claimable = cap minus already issued; signs and returns claim params for ClaimVault.claim().
- **GET /api/cdcu/eligibility?recipient=0x...** – Returns `eligible`, `totalPoints`, `claimableCap`, `alreadyClaimed`, `claimableNow` for the dashboard.

### Frontend

- **DashboardClaimCdcu** – Card on dashboard (when `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` is set): progress bar to 50 DCU points, “Claim $cDCU” when eligible and claimable > 0, disabled state when below 50 or nothing left to claim. Calls GET eligibility then POST claim-request then ClaimVault.claim().
- **frontend/src/lib/blockchain/claim-vault.ts** – `claimCdcu(signed)` calls ClaimVault.claim(recipient, amount, category, nonce, expiry, v, r, s).
- **CONTRACT_ADDRESSES.CLAIMVAULT** – From `NEXT_PUBLIC_CLAIMVAULT_ADDRESS`.
- **ENV_TEMPLATE.md** – `NEXT_PUBLIC_CLAIMVAULT_ADDRESS`, `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`, `CLAIM_VAULT_ISSUED_STORE_PATH`.

### Docs

- **docs/TOKEN_SPEC.md** – Eligibility at 50 DCU points and multiplier “(total − 50) × 0.1” documented; already-claimed tracked server-side.

### For the dev (handoff)

- **Contracts:** No Solidity changes are required for the 50-point rule or multiplier; they are enforced in the backend. Deploy with `deploy-cdcu.ts` when ready.
- **Env for deploy:** `AUTHORIZED_SIGNER_ADDRESS` = address of the backend wallet that will sign claims (not the deployer). Optional: `CLAIMVAULT_OWNER_MULTISIG` to transfer ClaimVault ownership after deploy.
- **Private keys:**
  - **Deployer private key:** Only needed to run `deploy-cdcu.ts` (and optionally transfer ownership). **You do not need to share the project owner’s deployer private key with the dev.** Options: (1) Owner deploys, shares `cdcu-deployed.json` and backend config; (2) Dev deploys from a team wallet, owner only provides `AUTHORIZED_SIGNER_ADDRESS` and keeps the **signer** key on their backend.
  - **Authorized signer private key:** Must live **only** on the server that runs the claim-request API (env `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`). Never commit or share it; the dev does not need it unless they operate that backend.
- **After deploy:** Set `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` in the frontend; set the signer key and optional `CLAIM_VAULT_ISSUED_STORE_PATH` in the backend. Eligibility and claim flow work once RPC and DCURewardManager address are correct.

---

## [Celo Sepolia Deployment & Integration] – 2025-12-16

This release focuses on deploying the RecyclablesReward contract to Celo Sepolia, implementing the full submission flow with contract integration, and enhancing the verifier dashboard with proper access control and data display.

### 🚀 Contract Deployment & Scripts

**Added**
- `contracts/scripts/deploy-recyclables.ts` - Deploys RecyclablesReward contract and wires it into Submission contract
  - Uses real cRECY token address (0x34C11A932853Ae24E845Ad4B633E3cEf91afE583)
  - Saves deployment addresses to JSON for reference
- `contracts/scripts/grant-verifier-role.ts` - Script to grant VERIFIER_ROLE to specified addresses
  - Uses viem-based Hardhat API
  - Includes delay and re-verification to handle blockchain state timing
  - Checks multiple deployment address locations (scripts, Ignition, env vars)

**Changed**
- `contracts/scripts/setup-roles.ts` - Explicitly grants VERIFIER_ROLE to verifier addresses
- `hardhat.config.ts` - Fixed dotenv.config() to load from project root, ensures PRIVATE_KEY has 0x prefix

**Removed**
- `contracts/contracts/MockERC20.sol` - No longer needed after real cRECY token address was provided

### 🔗 Frontend - Blockchain Integration

**Added**
- Full contract integration in `frontend/src/lib/blockchain/contracts.ts`:
  - `submitCleanup()` - Calls `createSubmission()` with proper parameter handling:
    - Lat/lng to int256 conversion
    - Referrer address handling
    - Impact form data hash
    - IPFS hash reference in dataURI (ipfs://${beforeHash})
    - Explicit gas limit (1M) to prevent gas estimation failures
  - `attachRecyclablesToSubmission()` - Calls `attachRecyclables()` on Submission contract
  - Verifier functions:
    - `isVerifier()` - Checks VERIFIER_ROLE
    - `verifyCleanup()` - Calls `approveSubmission()` with improved error handling
    - `rejectCleanup()` - Calls `rejectSubmission()` with improved error handling
    - `getCleanupCounter()` - Gets total submission count
  - Complete SUBMISSION_ABI with all custom error definitions and CleanupSubmission struct fields
  - Enhanced `getCleanupDetails()` with graceful error handling for missing submissions
  - Improved transaction polling (2s interval, 120s timeout) with better error messages

**Changed**
- `frontend/src/lib/blockchain/wagmi.ts`:
  - Standardized contract address environment variable names
  - Improved MetaMask detection and prioritization (default over WalletConnect)
  - Better connector configuration for Safari compatibility

### 🎨 Frontend - UI & Pages

**Added**
- Error handling components:
  - `frontend/src/app/error.tsx` - Error boundary component
  - `frontend/src/app/global-error.tsx` - Global error handler
  - `frontend/src/app/not-found.tsx` - 404 page

**Changed**
- `frontend/src/features/cleanup/pages/page.tsx`:
  - Integrated actual contract calls (submitCleanup, attachRecyclablesToSubmission)
  - Updated submission flow: After photos → Impact Report → Recyclables → Review/Success
  - Added note about 5,000 cRECY token reserve with links to block explorer and Detrash Global
  - Implemented success page with submission ID and auto-redirect
  - Updated button labels for each step in the flow

- `frontend/src/app/verifier/page.tsx`:
  - Implemented signature-based authentication for access control
  - Shows "Access Denied" for non-whitelisted addresses
  - Displays complete submission details:
    - Before/after photos with error handling and placeholders
    - Submitter wallet address
    - Impact report status badge
    - Recyclables status badge
    - Location coordinates
    - Submission timestamps
  - Fixed submission ID indexing (0-indexed instead of 1-indexed)
  - Improved error messages with transaction hashes and block explorer links
  - Fixed SSR issues with localStorage access

- `frontend/src/app/page.tsx`:
  - Removed VERIFIER stats section
  - Updated LINKS section:
    - Added WEBSITE (https://decleanup.net)
    - Added TOKENOMICS (https://decleanup.net/tokenomics)
    - Added FARCASTER (https://farcaster.xyz/decleanupnet)
    - Added BUG REPORT link (Google Form)
    - Updated LITEPAPER link to https://decleanup.net/litepaper
  - Updated referral messages:
    - Farcaster/X: Full message with @decleanupnet handle and referral link
    - Copy: Just "DeCleanup Rewards" without handle

### ⚙️ Frontend - Configuration & Infrastructure

**Changed**
- `frontend/next.config.mjs`:
  - Removed unsupported `turbopack` option
  - Added webpack alias to suppress MetaMask SDK async-storage warning

- `frontend/src/app/api/ipfs/upload/route.ts`:
  - Modified to accept both PINATA_SECRET_KEY and PINATA_SECRET_API_KEY
  - Better error handling for missing API keys

- `frontend/ENV_TEMPLATE.md`:
  - Updated with new environment variable names
  - Added instructions for Celo Sepolia deployment

### 🐛 Fixed

- Empty dataURI causing contract revert - now uses `ipfs://${beforeHash}`
- Gas estimation failures - added explicit gas limit (1M) for createSubmission
- Submission ID indexing error - fixed to use 0-indexed instead of 1-indexed
- Missing custom error definitions in ABI - added all Submission contract errors
- getCleanupDetails throwing on missing submissions - now returns default values gracefully
- Transaction waiting issues - added polling configuration with timeout
- Verifier dashboard showing no data - fixed to display all submission fields
- MetaMask not opening in Safari - improved connector detection and prioritization
- SSR errors with localStorage - added typeof window checks
- Missing error components warning - created error.tsx, global-error.tsx, not-found.tsx

### 📊 Statistics

- Total files changed: 99 files
- Lines added: ~6,354
- Lines removed: ~1,194
- Net change: +5,160 lines
- New scripts created: 2
- New frontend pages/components: 3

### ✅ Key Achievements

- ✅ Deployed RecyclablesReward contract on Celo Sepolia
- ✅ Integrated full submission flow with contract calls
- ✅ Implemented verifier dashboard with access control
- ✅ Fixed multiple contract interaction bugs
- ✅ Improved error handling and user feedback
- ✅ Updated UI/UX based on user feedback
- ✅ Standardized environment variable naming
- ✅ Fixed MetaMask connector issues for Safari

---

## [0.2.0] – 2025-12-02  
🚀 Major Refactor: Unified Reward System

This release removes the legacy reward engine, consolidates all reward logic under DCURewardManager, and updates the entire test suite to reflect the new architecture.

### Removed

- RewardLogic.sol  
  Fully removed from the codebase  
  All imports, references, and test files deleted

- Deprecated functions in Submission.sol:  
  - claimRewards  
  - claimableRewards  
  - getClaimableRewards  
  - RewardClaimed event

- Legacy reward pathways across contracts and tests  
- Unused or outdated deployment scripts related to RewardLogic

### Added

- New external function in DCURewardManager:  
  `distributeRewards(submissionId, user)`  
  Centralizes reward minting and distribution

- New RewardSource.Submission enum entry  
- Constructor-based role setup for DCUToken (MINTER_ROLE)  
- Test utilities supporting the new unified reward flow

### Changed — Contracts

**Submission.sol**
- Fully migrated to use DCURewardManager
- Removed internal reward-tracking state
- Updated events and state transitions

**DCURewardManager.sol**
- Centralized all reward logic (submission, referral, verifier, impact reports)
- Single source of truth for reward calculations

**DCUToken.sol**
- Removed legacy mint logic
- Cleaned constructor
- Added MINTER_ROLE for RewardManager

**ImpactProductNFT.sol**
- Minting flow aligned with unified reward system

### Deployment

**contracts/ignition/modules/DCUContracts.ts**
- Removed RewardLogic deployment
- Updated wiring and constructor params
- Consistent role assignments

### Tests

- Full test suite migrated to viem
- Updated mocks, addresses, event assertions
- All tests passing with unified reward architecture

### Security & Architecture

- All minting centralized under DCURewardManager
- Removed duplicate mint paths
- Reduced attack surface
- Improved auditability and predictability

---

## [Unreleased] – Sprint 1 Progress

### 🔧 Core Contract Fixes & Improvements
- Correct reward distribution for approved submissions
- Fully operational impact-report and recyclables reward paths
- Stable Submission → RewardManager → DCUToken integration
- Fixed userImpactFormCount tracking
- Corrected Hypercert eligibility logic
- Event reorganization for clarity

### 🪪 Roles & Access Control
- Strict separation between ADMIN_ROLE and VERIFIER_ROLE
- MAIN_DEPLOYER owns Submission and admin roles
- DCURewardManager granted MINTER_ROLE
- setup-roles.ts improved with validation and syncing

### 📦 Deployment & Ignition
- Ignition modules updated to deploy:
  - DCUToken
  - DCURewardManager
  - Submission
  - ImpactProductNFT
  - DCUStorage
  - DCUAccounting
- Automatic role grants during deployment
- Export of deployed addresses to deployed_addresses.json

### 🛠 Scripts
- setup-roles.ts updated to:
  - Sync ownership
  - Grant core roles
  - Validate configuration

---

## [Sprint 1 – Backend Stabilization] – 2025-12-10

### Added
- Referral reward variable fully implemented
- VERIFIER_ROLE enforcement fixed
- Hypercert eligibility based on ImpactProductNFT level
- New end-to-end reward tests

### Changed
- setup-roles.ts assigns:
  - VERIFIER_ROLE only to verifiers
  - ADMIN_ROLE only to deployer
- Submission approval flow stabilized

### Fixed
- Recyclables reward path
- Removal of all fee logic
- Reward consistency across all flows

### Removed
- Legacy submission fee logic
- Hardcoded referral reward branches
- Cleanup-count-based eligibility checks

### Security
- Only RewardManager may mint
- Submission has no privileged mint paths
- Single source of truth for eligibility

---

## Frontend – MVP Stabilization & Build Fixes (2025-12-13)

This phase focused on stabilizing the frontend, unblocking the build, and aligning UI behavior with the current contract surface and MVP scope.

### General
- Frontend builds cleanly with strict TypeScript enabled
- All blockchain interactions aligned with current contracts or explicit MVP stubs
- No partially enabled or broken features remain

### Blockchain Layer (Frontend)
- Removed assumption of a single contracts index
- Standardized imports under lib/blockchain/*
- Introduced explicit MVP stubs with predictable returns
- Removed non-existent exports and broken references
- Unified getCleanupDetails return shape across app

### Cleanup & Verification Flow
- Enforced single active cleanup per user in the UI
- Cleanup submission lock enforced:
  Submit → locked → verify → claim → unlock
- Verification relies on getCleanupDetails + localStorage
- Removed duplicated status helpers and redeclared symbols
- Verifier approve/reject flow stabilized and aligned with Submission

### Profile
- Fixed bigint vs number mismatches
- tokenId optional and nullable (MVP-safe)
- Graceful fallback for metadata and images
- Staking, streak, and level logic aligned with stubs

### Leaderboard
- Corrected cleanup ownership (submitter → user)
- Normalized DCU balances for sorting
- Limited scan range for safety
- Optional and resilient geolocation enrichment

### Utilities & Debug
- Fixed find-cleanup utility
- Scoped helpers to configured contract addresses
- Improved error handling

### Hypercerts (MVP Scope)
- Image generation utilities exist but are disabled
- CleanupData import assumptions corrected
- Ensured IPFS uploads use File objects
- Hypercert minting remains experimental

### Result
- Clean build
- Clear MVP scope
- Predictable UI flows
- Ready for deploy and iteration

