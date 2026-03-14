# DeCleanup Network - Developer Specifications

**Version:** 1.0  
**Last Updated:** January 2025  
**Project:** DeCleanup Network MVP on Celo Sepolia

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Key Components](#key-components)
6. [Workflows](#workflows)
7. [Environment Setup](#environment-setup)
8. [Development Guidelines](#development-guidelines)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

**DeCleanup Network** is a Web3 platform that incentivizes environmental cleanup by turning verified cleanups into on-chain impact certificates (Hypercerts) and token rewards.

### Core Value Proposition
- Users submit cleanup photos with before/after evidence
- AI/ML verification (YOLOv8) automatically detects waste reduction
- Verified cleanups unlock:
  - **$DCU tokens** (ERC20 reward token)
  - **DCU points** for impact form and/or recyclables (5 DCU total per submission, same bucket; $cDCU claimed later based on multiplier)
  - **Impact Product NFTs** (level up with verified cleanups)
  - **Hypercerts** (every 10 verified cleanups)

### Current Status
- ✅ **Smart Contracts**: Deployed & verified on Celo Sepolia
- ✅ **Frontend**: Next.js 16 app with full submission/verification flow
- ✅ **ML Verification**: YOLOv8 GPU inference service integrated
- ✅ **Hypercerts**: Integration complete, minting enabled
- 🚧 **Production**: VPS deployment at `207.180.203.243`

### Branch Strategy
**Important**: Active development for Hypercerts and AI/ML features is happening in separate feature branches:
- **`hypercerts-integration`** - Hypercerts minting, metadata generation, and integration work
- **`AI-verification`** - ML verification improvements, model fine-tuning, and AI enhancements

The `main` branch contains stable, production-ready code. When working on Hypercerts or AI features, check out the respective feature branch. Merges to `main` happen after features are tested and stable.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14.2.15 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **UI Library**: shadcn/ui + Tailwind CSS 4
- **Blockchain**: 
  - `wagmi` v2.19.2 (React hooks for Ethereum)
  - `viem` v2.38.6 (TypeScript Ethereum library)
  - `@rainbow-me/rainbowkit` v2.2.10 (Wallet connection)
- **State Management**: Zustand 5.0.8
- **Data Fetching**: TanStack Query (React Query) 5.90.7
- **Hypercerts**: `@hypercerts-org/sdk` v2.9.1
- **AI Generation**: `@google/generative-ai` v0.21.0 (Gemini API)

### Smart Contracts
- **Language**: Solidity ^0.8.20
- **Framework**: Hardhat
- **Network**: Celo Sepolia (Chain ID: 44787)
- **Standards**: ERC20, ERC721, ERC1155 (Hypercerts)

### ML/AI Services
- **Model**: YOLOv8 (fine-tuned on TACO dataset)
- **Inference**: FastAPI (Python) GPU service
- **Detection**: 60+ waste categories (plastic, glass, metal, paper, etc.)

### Infrastructure
- **IPFS**: Pinata (for photo/metadata storage)
- **Deployment**: VPS (Contabo) with PM2
- **RPC**: Celo Sepolia public RPC + Infura/Alchemy options

---

## Architecture

### High-Level Flow

```
[User Wallet] 
    ↓ (walletconnect/wagmi)
[Next.js Frontend]
    ├─→ [Celo Contracts] (via viem RPC)
    ├─→ [IPFS/Pinata] (photo/metadata storage)
    ├─→ [GPU Inference Service] (YOLOv8 waste detection)
    ├─→ [Hypercerts SDK] (mintClaim on Celo)
    └─→ [Gemini API] (optional AI image generation)
```

### Service Architecture

#### 1. Frontend (Next.js)
- **Location**: `frontend/`
- **Entry Point**: `frontend/src/app/page.tsx`
- **Key Routes**:
  - `/` - Dashboard
  - `/cleanup` - Submission flow
  - `/verifier` - Verifier review interface
  - `/create-hypercert` - Hypercert minting flow
  - `/leaderboard` - Top users ranking

#### 2. Smart Contracts
- **Location**: `contracts/contracts/`
- **Deployed Addresses**: `contracts/scripts/deployed_addresses.json`
- **Key Contracts**:
  - `Submission.sol` - Core cleanup submission & verification
  - `DCURewardManager.sol` - Reward distribution logic
  - `DCUToken.sol` - ERC20 reward token
  - `ImpactProductNFT.sol` - Dynamic NFT that levels up
  - Recyclables: optional step (photo + receipt); rewarded with DCU points in same bucket as impact form (5 DCU per submission, no separate contract)

#### 3. ML Verification Service
- **VPS Backend**: `frontend/src/app/api/ml-verification/verify/route.ts`
- **GPU Service**: `gpu-inference-service/main.py`
- **Flow**:
  1. User submits before/after photos → IPFS
  2. VPS downloads photos from IPFS
  3. VPS calls GPU service for inference
  4. VPS computes verification score
  5. VPS stores verification hash on-chain

#### 4. Hypercerts Integration
- **SDK Client**: `frontend/src/lib/blockchain/hypercerts-client.ts`
- **Minting**: `frontend/src/lib/blockchain/hypercerts-minting.ts`
- **Data Aggregation**: `frontend/src/lib/blockchain/hypercerts-data.ts`
- **Metadata**: `frontend/src/lib/blockchain/hypercerts-metadata.ts`

---

## Project Structure

```
DCUCELOMVP/
├── contracts/              # Hardhat project
│   ├── contracts/         # Solidity smart contracts
│   ├── test/             # Hardhat tests
│   ├── scripts/          # Deployment & utility scripts
│   └── ignition/         # Hardhat Ignition deployment modules
│
├── frontend/              # Next.js application
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   │   ├── api/      # API routes (IPFS, ML verification)
│   │   │   ├── cleanup/  # Submission flow
│   │   │   ├── verifier/ # Verifier interface
│   │   │   └── create-hypercert/ # Hypercert minting
│   │   ├── components/  # React components
│   │   ├── lib/          # Core libraries
│   │   │   ├── blockchain/ # Contract interactions, Hypercerts
│   │   │   ├── dmrv/     # ML verification logic
│   │   │   └── utils/    # Utilities (image gen, IPFS helpers)
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # TypeScript type definitions
│   └── package.json
│
├── gpu-inference-service/ # YOLOv8 FastAPI service
│   ├── main.py           # FastAPI app
│   └── requirements.txt  # Python dependencies
│
├── hypercerts/           # Hypercerts SDK & contracts (vendored)
│   ├── contracts/        # HypercertMinterUUPS contract
│   └── sdk/              # Hypercerts SDK source
│
└── docs/                 # Documentation
    ├── system-architecture.md
    ├── HYPERCERTS_STATUS.md
    ├── AI_MODEL_FINETUNING_GUIDE.md
    └── ...
```

---

## Key Components

### Frontend Libraries

#### `lib/blockchain/contracts.ts`
**Purpose**: Primary interface for smart contract interactions

**Key Functions**:
- `submitCleanup()` - Submit cleanup with photos & metadata
- `getCleanupDetails()` - Fetch cleanup data from contract
- `getUserSubmissions()` - Get all user's cleanups
- `approveCleanup()` / `rejectCleanup()` - Verifier actions
- `claimRewards()` - Claim accumulated $DCU rewards
- `getHypercertEligibility()` - Check if user can mint Hypercert

**Usage**:
```typescript
import { submitCleanup } from '@/lib/blockchain/contracts'

const result = await submitCleanup({
  beforePhotoHash: 'ipfs://...',
  afterPhotoHash: 'ipfs://...',
  location: { lat: 40.7128, lng: -74.0060 },
  impactFormDataHash: 'ipfs://...' // optional
})
```

#### `lib/blockchain/hypercerts-minting.ts`
**Purpose**: Orchestrates full Hypercert minting process

**Key Functions**:
- `mintHypercert()` - Complete minting flow:
  1. Aggregate cleanup data (last 10 verified)
  2. Generate/upload images (collage or custom)
  3. Generate metadata JSON
  4. Upload metadata to IPFS
  5. Mint Hypercert on-chain
  6. Claim reward (10 $DCU bonus)

**Usage**:
```typescript
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'

const result = await mintHypercert(
  userAddress,
  hypercertNumber,
  customImageHash // optional, uses collage if omitted
)
```

#### `lib/dmrv/gpu-verification.ts`
**Purpose**: ML verification scoring & decision logic

**Key Functions**:
- `runFullVerification()` - Orchestrates GPU inference + scoring
- `computeVerificationScore()` - Calculates verification score from detection results
- `hashVerificationResult()` - Creates on-chain hash

**Scoring Formula**:
```typescript
trashDelta = before.objectCount - after.objectCount
normalizedTrashDelta = min(delta / 50, 1.0)
meanConfidence = (before.meanConfidence + after.meanConfidence) / 2
impactDataBoost = calculateBoost(impactReportData) // up to 0.3

score = (meanConfidence * 0.3) + (normalizedTrashDelta * 0.7) + impactDataBoost

// Verdict thresholds:
// AUTO_VERIFIED: score >= 0.35
// NEEDS_REVIEW: score >= 0.15
// REJECTED: score < 0.15
```

#### `lib/utils/hypercert-image-generator.ts`
**Purpose**: Generates Hypercert collage from cleanup photos

**Key Functions**:
- `generateHypercertCollage()` - Creates before/after photo collage
- Handles IPFS gateway fallbacks with timeouts
- Returns IPFS hash of generated image

#### `lib/gemini.ts`
**Purpose**: AI image generation using Google Gemini API

**Key Functions**:
- `generateLogoSVG()` - Generate logo SVG from text prompt
- `generateBannerSVG()` - Generate banner SVG from text prompt
- Handles quota errors gracefully
- Falls back through multiple model names

**Models Tried** (in order):
1. `gemini-1.5-flash` (fastest)
2. `gemini-1.5-pro` (higher quality)
3. `gemini-2.0-flash-exp` (experimental)

### API Routes

#### `POST /api/ml-verification/verify`
**Purpose**: VPS backend for ML verification orchestration

**Request Body**:
```typescript
{
  submissionId: string
  beforeImageCid: string  // IPFS CID
  afterImageCid: string   // IPFS CID
  impactReportData?: {    // optional
    weight?: number
    area?: number
    hours?: number
    bags?: number
  }
}
```

**Response**:
```typescript
{
  verdict: 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED'
  score: number
  verificationHash: string  // bytes32 hash for on-chain storage
  beforeCount: number
  afterCount: number
  delta: number
  impactDataBoost?: number
}
```

#### `POST /api/ipfs/upload`
**Purpose**: Server-side proxy for Pinata IPFS uploads (keeps API keys private)

**Request**: `FormData` with `file` and optional `metadata`

**Response**:
```typescript
{
  hash: string  // IPFS CID
  pinataUrl: string
}
```

### Smart Contracts

#### `Submission.sol`
**Core Contract**: Manages cleanup lifecycle

**Key Functions**:
- `submitCleanup()` - Submit cleanup with IPFS hashes
- `approveCleanup()` - Verifier approves (triggers rewards)
- `rejectCleanup()` - Verifier rejects
- `storeVerificationHash()` - Store ML verification hash (verifier-only)
- `getCleanupDetails()` - View cleanup data

**Storage**:
- `cleanups[]` - Array of cleanup structs
- `verificationHash[]` - ML verification hashes (bytes32)
- `userHypercertCount[]` - Tracks Hypercert eligibility

#### `DCURewardManager.sol`
**Purpose**: Centralized reward distribution

**Reward Types**:
- Impact claims (base reward per cleanup)
- Streaks (consecutive cleanups)
- Referrals (invite bonuses)
- Impact reports (extra data bonus)
- Verifier rewards
- Recyclables (optional step; 5 DCU with impact form bucket)

**Key Function**: `claimRewards()` - Users claim accumulated balance

#### `ImpactProductNFT.sol`
**Purpose**: Dynamic NFT that levels up with verified cleanups

**Levels**:
- Level 1: 1-4 verified cleanups
- Level 2: 5-9 verified cleanups
- Level 3: 10-19 verified cleanups
- Level 4: 20-49 verified cleanups
- Level 5: 50+ verified cleanups

---

## Workflows

### 1. Cleanup Submission Flow

```
User Action:
1. Connect wallet (RainbowKit)
2. Navigate to /cleanup
3. Upload before/after photos
4. Capture location (GPS)
5. (Optional) Fill impact form (weight, area, time, waste types)
6. (Optional) Submit recyclables (photo + receipt hash)

Frontend:
1. Upload photos to IPFS via /api/ipfs/upload
2. Upload impact form JSON to IPFS (if provided)
3. Call submitCleanup() on Submission.sol
4. Contract emits CleanupSubmitted event

On-Chain:
- Submission.sol stores IPFS hashes
- Cleanup status: PENDING
- User's cleanup counter increments
```

### 2. ML Verification Flow

```
Trigger: After cleanup submission (or manual trigger)

VPS Backend (/api/ml-verification/verify):
1. Download before/after photos from IPFS
2. Store photos on VPS filesystem: /uploads/{submissionId}/
3. Call GPU Inference Service:
   POST http://{GPU_SERVICE}/infer
   - before.jpg
   - after.jpg
4. Receive detection results (object counts, confidence scores)
5. Fetch impact report data from IPFS (if available)
6. Compute verification score:
   - Calculate trash delta (before - after)
   - Weight confidence scores
   - Apply impact data boost
7. Generate verdict (AUTO_VERIFIED / NEEDS_REVIEW / REJECTED)
8. Hash verification result
9. Store hash on-chain via storeVerificationHash()

GPU Service:
- Runs YOLOv8 inference
- Returns JSON: { objects: [...], meanConfidence: number }
```

### 3. Verifier Review Flow

```
Verifier Action:
1. Navigate to /verifier
2. View pending cleanups list
3. Review photos, location, impact data
4. Approve or reject

Frontend:
- Calls approveCleanup() or rejectCleanup()
- If approved: triggers reward distribution
- If rejected: cleanup marked as rejected

On-Chain (approval):
- Submission.sol: status → APPROVED
- DCURewardManager: accrues rewards
- ImpactProductNFT: checks level up
- Recyclables: same bucket as impact form; rewardImpactReports(submitter, 1) once when hasImpactForm || hasRecyclables
```

### 4. Hypercert Minting Flow

```
Trigger: User reaches 10 verified cleanups

User Action:
1. Navigate to /create-hypercert
2. Click "Fetch Impact Data" (aggregates last 10 cleanups)
3. (Optional) Upload/generate logo
4. (Optional) Upload/generate banner (or use default collage)
5. Click "Mint Hypercert"

Frontend Process:
1. Aggregate cleanup data:
   - Fetch last 10 verified cleanups
   - Sum weight, area, hours
   - Collect before/after photo hashes
   - Aggregate waste types
2. Generate/upload images:
   - Option A: Generate collage from cleanup photos
   - Option B: Upload custom banner
   - Option C: Generate banner via Gemini AI
3. Generate metadata JSON:
   - Hypercert properties (name, description)
   - Scopes (work time, work scope)
   - Contributors
   - Rights (from, to, percentage)
4. Upload metadata to IPFS
5. Mint Hypercert:
   - Call Hypercerts SDK mintClaim()
   - Transfer restrictions: FromCreatorOnly
6. Claim reward:
   - Call claimHypercertReward(hypercertNumber)
   - Grants 10 $DCU bonus

On-Chain:
- HypercertMinterUUPS: Mints ERC1155 token
- Submission.sol: Increments userHypercertCount
- DCURewardManager: Accrues 10 $DCU reward
```

---

## Environment Setup

### Frontend Environment Variables

**File**: `frontend/.env.local`

```bash
# Blockchain
NEXT_PUBLIC_CHAIN_ID=44787
NEXT_PUBLIC_RPC_URL=https://celo-sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celoscan.io

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract Addresses
NEXT_PUBLIC_SUBMISSION_CONTRACT=0x1e355123f9dec3939552d80ad1a24175fd10688f
NEXT_PUBLIC_DCU_TOKEN_CONTRACT=0xa282c26245d116aB5600fBF7901f2E4827c16B7A
NEXT_PUBLIC_REWARD_MANAGER_CONTRACT=0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a
NEXT_PUBLIC_IMPACT_PRODUCT_NFT_CONTRACT=0x97448790fd64dd36504d7f5ce7c2d27794b01959
# Recyclables: no separate contract; 5 DCU with impact form bucket

# Hypercerts
NEXT_PUBLIC_HYPERCERTS_MINTER_ADDRESS=0x8610fe3190E21bf090c9F463b162A76478A88F5F
NEXT_PUBLIC_HYPERCERTS_GRAPH_URL=https://api.studio.thegraph.com/query/...

# IPFS (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# ML Verification
GPU_INFERENCE_SERVICE_URL=http://207.180.203.243:8000
GPU_SHARED_SECRET=your_shared_secret

# AI Generation (Optional)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### Contracts Environment Variables

**File**: `contracts/.env`

```bash
# Network
CELO_SEPOLIA_RPC_URL=https://celo-sepolia.infura.io/v3/YOUR_KEY
CELOSCAN_API_KEY=your_celoscan_api_key

# Deployment
PRIVATE_KEY=0x... (deployer private key)
MNEMONIC=your mnemonic phrase (alternative to PRIVATE_KEY)
```

### GPU Inference Service

**File**: `gpu-inference-service/.env` (or environment variables)

```bash
SHARED_SECRET=your_shared_secret
MODEL_PATH=/path/to/yolov8n.pt
CONF_THRESHOLD=0.10
```

---

## Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types
- **React**: Functional components with hooks
- **Naming**: 
  - Components: PascalCase (`CleanupSubmission.tsx`)
  - Functions: camelCase (`submitCleanup()`)
  - Constants: UPPER_SNAKE_CASE (`MAX_REWARDS`)
- **Imports**: Group by type (React, Next.js, libs, components, types)

### File Organization

- **Components**: One component per file, co-locate related components
- **Hooks**: Custom hooks in `hooks/` directory
- **Utils**: Pure functions in `lib/utils/`
- **Types**: Shared types in `types/` directory

### Error Handling

- **API Routes**: Return `NextResponse.json()` with status codes
- **Contract Calls**: Wrap in try/catch, show user-friendly errors
- **Async Operations**: Use `async/await`, handle rejections

### Testing

- **Frontend**: Jest + React Testing Library
- **Contracts**: Hardhat tests in `contracts/test/`
- **Run Tests**:
  ```bash
  cd frontend && npm test
  cd contracts && npx hardhat test
  ```

### Git Workflow

- **Branches**:
  - `main` - Production-ready code (stable, deployed)
  - `hypercerts-integration` - **Active development** for Hypercerts features (minting, metadata, integration)
  - `AI-verification` - **Active development** for ML/AI features (model fine-tuning, verification improvements)
- **Branch Strategy**: 
  - Feature development happens in `hypercerts-integration` and `AI-verification` branches
  - Only tested, stable code merges to `main`
  - When starting work on Hypercerts or AI features, checkout the respective branch first
- **Commits**: Descriptive messages, reference issues/PRs

---

## Deployment

### VPS Deployment (Production)

**Server**: `207.180.203.243`  
**Process Manager**: PM2  
**Location**: `/var/www/decleanup/`

#### Deployment Steps

1. **Upload Files**:
   ```bash
   scp -r frontend/* root@207.180.203.243:/var/www/decleanup/frontend/
   ```

2. **Install Dependencies**:
   ```bash
   ssh root@207.180.203.243
   cd /var/www/decleanup/frontend
   npm install
   ```

3. **Build**:
   ```bash
   npm run build
   ```

4. **Restart PM2**:
   ```bash
   pm2 restart decleanup --update-env
   pm2 save
   ```

#### Deployment Scripts

- `deploy-hypercerts-fix.sh` - Deploy Hypercerts fixes
- `deploy-create-hypercert.sh` - Deploy Hypercert page
- `sync-all-files.sh` - Sync all frontend files

### Contract Deployment

**Network**: Celo Sepolia  
**Tool**: Hardhat Ignition

```bash
cd contracts
npx hardhat ignition deploy ignition/modules/DCUContracts.ts --network celo-sepolia
```

**Post-Deployment**:
1. Verify contracts on CeloScan
2. Run `scripts/setup-roles.ts` to assign roles
3. Update `deployed_addresses.json`
4. Update frontend `.env.local` with new addresses

---

## Testing

### Frontend Tests

```bash
cd frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Contract Tests

```bash
cd contracts
npx hardhat test                    # Run all tests
npx hardhat test test/Submission.ts # Run specific test
npx hardhat coverage                # Coverage report
```

### Manual Testing Checklist

- [ ] Wallet connection (RainbowKit)
- [ ] Cleanup submission with photos
- [ ] ML verification (check GPU service logs)
- [ ] Verifier approval/rejection
- [ ] Reward claiming
- [ ] Hypercert minting (after 10 cleanups)
- [ ] Leaderboard display
- [ ] IPFS uploads (photos, metadata)

---

## Troubleshooting

### Common Issues

#### 1. "Missing environment" (Hypercerts)
**Error**: `HypercertClient: Missing environment`  
**Fix**: Ensure `NEXT_PUBLIC_HYPERCERTS_MINTER_ADDRESS` is set in `.env.local`

#### 2. "Client is readonly" (Hypercerts)
**Error**: `Client is readonly`  
**Fix**: Check `hypercerts-client.ts` has `walletClient`, `publicClient`, and `contractAddress` configured

#### 3. Gemini API Quota Exceeded
**Error**: `429 quota exceeded`  
**Fix**: Users can upload their own images instead. Error handling shows user-friendly message.

#### 4. GPU Service Connection Failed
**Error**: `Failed to fetch` from GPU service  
**Fix**: 
- Check `GPU_INFERENCE_SERVICE_URL` in `.env.local`
- Verify GPU service is running: `curl http://207.180.203.243:8000/health`
- Check firewall rules

#### 5. IPFS Upload Failed
**Error**: `Pinata API keys not configured`  
**Fix**: Set `PINATA_API_KEY` and `PINATA_SECRET_KEY` in `.env.local`

#### 6. Contract Call Failed
**Error**: `Transaction reverted`  
**Fix**:
- Check user has sufficient gas
- Verify contract addresses in `.env.local`
- Check user has required permissions (e.g., verifier role)

### Debugging

#### Frontend Logs
- Browser console: `console.log()` statements
- Network tab: Check API calls, contract transactions
- React DevTools: Inspect component state

#### Backend Logs (VPS)
```bash
ssh root@207.180.203.243
pm2 logs decleanup
```

#### GPU Service Logs
```bash
ssh root@207.180.203.243
# Check GPU service logs (depends on how it's running)
docker logs gpu-inference-service
# or
pm2 logs gpu-service
```

#### Contract Events
- Use CeloScan to view contract events
- Or query via `viem`:
  ```typescript
  const logs = await publicClient.getLogs({
    address: SUBMISSION_CONTRACT,
    event: parseAbiItem('event CleanupSubmitted(uint256 indexed cleanupId)')
  })
  ```

---

## Additional Resources

### Documentation
- [System Architecture](system-architecture.md)
- [Hypercerts Integration Status](HYPERCERTS_STATUS.md)
- [AI Model Fine-tuning Guide](AI_MODEL_FINETUNING_GUIDE.md)
- [ML Verification Architecture](ML_VERIFICATION_ARCHITECTURE.md)
- [Deployment Plan](deployment-plan.md)

### External Links
- **Website**: [decleanup.net](https://decleanup.net)
- **Celo Sepolia Explorer**: [CeloScan](https://celoscan.io)
- **Hypercerts Docs**: [hypercerts.org](https://hypercerts.org)
- **YOLOv8**: [Ultralytics](https://docs.ultralytics.com)

### Key Contacts
- **VPS**: `207.180.203.243` (root access required)
- **Contract Addresses**: See `contracts/scripts/deployed_addresses.json`

---

## Quick Reference

### Important File Paths

```
Frontend Entry:        frontend/src/app/page.tsx
Contract Interface:    frontend/src/lib/blockchain/contracts.ts
Hypercert Minting:     frontend/src/lib/blockchain/hypercerts-minting.ts
ML Verification:       frontend/src/lib/dmrv/gpu-verification.ts
API Routes:            frontend/src/app/api/
Smart Contracts:       contracts/contracts/
Deployed Addresses:    contracts/scripts/deployed_addresses.json
```

### Common Commands

```bash
# Frontend
cd frontend && npm run dev
cd frontend && npm run build

# Contracts
cd contracts && npx hardhat test
cd contracts && npx hardhat run scripts/setup-roles.ts --network celo-sepolia

# Deployment
scp frontend/src/** root@207.180.203.243:/var/www/decleanup/frontend/src/
ssh root@207.180.203.243 "cd /var/www/decleanup/frontend && npm run build && pm2 restart decleanup"
```

---

**Last Updated**: January 2025  
**Maintained By**: DeCleanup Network Team
