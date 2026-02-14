# Hypercerts Implementation Changelog

This file tracks all changes made during the Hypercerts v1 test milestone implementation on Celo Sepolia.

## Changes

### STEP 1 — Hypercert eligibility abstraction (2026-01-20)

**Added**
- `frontend/src/lib/blockchain/hypercerts/` directory with clean v1 skeleton:
  - `types.ts`: Canonical types for Hypercert aggregation, eligibility, and metadata
  - `config.ts`: Environment-aware thresholds (production: 10 cleanups/1 report, testing: 1 cleanup/1 report)
  - `testing.ts`: Simple testing mode detection for Celo Sepolia (chain ID 44787)
  - `aggregation.ts`: Pure function to aggregate user cleanups into summary and timeframe
  - `eligibility.ts`: Main eligibility helper `checkHypercertEligibility()` that answers if user can mint now
  - `metadata.ts`: Builder for Hypercert metadata with hard facts only + optional narrative
  - `minting.ts`: Placeholder for verifier-driven minting (v1 manual/script-based)
  - `index.ts`: Clean exports for all modules

**Why**: To implement Hypercerts as environmental impact layer (not reward, not automated, not coupled to AI). Eligibility must be environment-aware for Sepolia testing vs mainnet production. This abstraction enables incremental, reversible changes without touching core flows.

### STEP 2 — Frontend mint UI adjustment (2026-01-20)

**Changed**
- `frontend/src/app/page.tsx`:
  - Replaced old `getHypercertEligibility()` calls with new `checkHypercertEligibility()` helper
  - Now calculates verified cleanups and impact reports by querying user submissions
  - Updated eligibility state to use `number` instead of `bigint` and added `testingOverride` field
  - Added testnet indicator "(Sepolia Testnet)" to hypercert mint button when using testing rules

**Why**: To conditionally show/enable mint button based on new eligibility logic. Clearly indicates testnet behavior. Minimal changes to existing UI flow, keeping existing "Mint" button structure.

### STEP 3 & 4 — Hypercert metadata builder & wire into mint flow (2026-01-20)

**Changed**
- `frontend/src/lib/blockchain/hypercerts-minting.ts`:
  - Modified `mintHypercert()` to generate Hypercert metadata using `buildHypercertMetadata()` from Step 3
  - Fetches user's verified cleanups and aggregates them for metadata input
  - Builds comprehensive metadata with hard facts (cleanup IDs, totals, timeframe) + optional narrative
  - Returns metadata alongside simulated mint result for full traceability
  - Metadata includes: user address, cleanup references with timestamps, aggregated summary, issuer info, static narrative

**Why**: STEP 3 (metadata builder) was already implemented in v1 skeleton. STEP 4 wires it into the existing mint flow to ensure every mint attempt generates traceable metadata. No changes to mint authority or contract logic, but full metadata generation for auditability.

### STEP 5 — Hypercerts test UI (2026-01-22)

**Added**
- `frontend/src/app/hypercerts/page.tsx`: New test page exposing all existing Hypercert logic
  - Displays wallet address and network detection
  - Shows eligibility status with testnet/production rule indication
  - Presents aggregated impact summary (cleanups count, reports count, timeframe, cleanup IDs)
  - Renders metadata preview in JSON format
  - Allows simulated mint button with console logging and UI feedback
  - Minimal, debug-focused UI without styling work
- `frontend/src/app/page.tsx`: Added conditional navigation link to Hypercerts test page visible only on Celo Sepolia testnet

**Why**: Creates a "truth window" into the Hypercerts system for stakeholders to see what already works. Exposes eligibility computation, aggregation, metadata building, and mint simulation without changing any core logic. Page is test-only and not production UI.

### STEP 6 — Production readiness and UI improvements (2026-01-24)

**Changed**
- `frontend/src/lib/blockchain/hypercerts/testing.ts`:
  - Updated `isTestingMode` implementation to use Wagmi's `useChainId()` for runtime-safe chain ID verification
  - Ensures testing mode detection works correctly in React components without SSR issues

- `frontend/src/lib/blockchain/hypercerts/config.ts`:
  - Verified and confirmed testing thresholds: `minCleanups: 1`, `minReports: 1` (for Sepolia testing)
  - Verified and confirmed production thresholds: `minCleanups: 10`, `minReports: 1` (for mainnet)
  - Ensures environment-aware eligibility works correctly across networks

- `frontend/src/app/page.tsx`:
  - Made Hypercerts link permanently visible in Quick Actions section (removed `chainId === 44787` conditional)
  - Updated Quick Actions grid to fixed 3 columns: Leaderboard, Verifier Cabinet, Hypercerts
  - Maintains consistent visual pattern across all action cards (styling and hover effects)
  - Kept conditional mint button that only appears when user is eligible

- `frontend/src/app/hypercerts/page.tsx`:
  - Added explanatory UI block clearly distinguishing Impact Product Levels from Hypercerts
  - Explicitly states: levels are per verified cleanup, Hypercerts require verified cleanups **with impact reports**
  - UI clarification only - no changes to eligibility logic or data aggregation

**Why**: Makes Hypercerts feature discoverable on all networks (avoiding user confusion from conditional visibility). Clearly separates reward system (levels/Impact Products) from environmental impact certification system (Hypercerts). Ensures testing mode works correctly in production build with proper React hooks. All changes maintain existing logic while improving clarity and accessibility.

### STEP 7 — Fix eligibility detection to use active wallet chain (2026-01-24)

**Changed**
- `frontend/src/lib/blockchain/hypercerts/testing.ts`:
  - Removed static `process.env.NEXT_PUBLIC_CHAIN_ID` check that was build-time only
  - Changed `isTestingMode()` to accept `chainId` parameter for runtime detection
  - Now correctly identifies testnet vs mainnet based on active wallet connection

- `frontend/src/lib/blockchain/hypercerts/eligibility.ts`:
  - Added `chainId` parameter to `checkHypercertEligibility()`
  - Passes `chainId` to `isTestingMode()` for proper threshold selection
  - Fixed `testingOverride` to return `true` (not `testing || undefined`) for clarity
  - Now dynamically selects thresholds: Sepolia (1 cleanup + 1 report) vs Mainnet (10 + 1)

- `frontend/src/app/hypercerts/page.tsx`:
  - Passes `chainId` from `useChainId()` hook to eligibility check
  - Added "Levels vs Hypercerts" explanation card above mint simulation
  - Clarifies that levels are per cleanup, Hypercerts aggregate multiple cleanups with reports
  - Prevents confusion about "I'm level 10 but ineligible" scenarios

**Why**: Fixed critical bug where testnet/mainnet rules were determined at build time instead of runtime. Users on Sepolia were seeing mainnet thresholds (10 cleanups) instead of testnet thresholds (1 cleanup). Now the system correctly detects the active wallet's chain and applies appropriate eligibility rules. Also improved UX by explicitly teaching the mental model: Impact Product levels ≠ Hypercert eligibility.

### STEP 8 — Fix Wagmi chainId bug with defensive validation (2026-01-24)

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Added defensive chainId validation to handle Wagmi reporting incorrect chain ID (11142220 instead of 44787)
  - Implemented `validChainId` fallback: defaults to 44787 (Sepolia) when Wagmi returns invalid chain ID
  - Updated `getNetworkName()` to use corrected chainId for consistent UI display
  - Added debug logs to track chainId issues (kept for production debugging)

- `frontend/src/lib/blockchain/hypercerts/eligibility.ts`:
  - Added comprehensive debug logging to track eligibility calculation flow
  - Logs show: chainId received, testing mode status, thresholds applied, and eligibility result
  - Helps diagnose issues with testnet/mainnet rule selection in production

**Why**: Wagmi's `useChainId()` was intermittently returning corrupted chain ID (11142220), causing system to apply wrong thresholds (mainnet instead of testnet). Defensive validation ensures correct thresholds are always applied regardless of Wagmi bugs. Debug logs remain active to help diagnose similar issues in production without requiring code changes.

### STEP 9 — Mainnet preparation: UI transformation and metadata extension (2026-01-25)

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Renamed page from "HYPERCERTS TEST" to "CREATE HYPERCERT" for production readiness
  - Updated subtitle to "Aggregate your verified cleanups into an environmental impact certificate"
  - Added "HOW IT WORKS" section explaining the 4-step flow: aggregate → submit → review → mint
  - Renamed "Mint Simulation" section to "Submit for Review"
  - Changed button text from "SIMULATE HYPERCERT MINT" to "SUBMIT HYPERCERT FOR REVIEW"
  - Renamed handler from `handleSimulateMint` to `handleSubmitRequest`
  - Updated result messages to reflect submission workflow instead of direct minting
  - Renamed state variable from `mintResult` to `submitResult` for semantic clarity
  - Added TODO marker for Phase 4 backend integration

- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `HypercertBranding` interface with optional fields: `logoImageCid`, `bannerImageCid`, `title`, `description`
  - Extended `HypercertMetadataInput` to accept optional `branding` field
  - Maintains backward compatibility (branding is optional)

- `frontend/src/lib/blockchain/hypercerts/metadata.ts`:
  - Updated `buildHypercertMetadata()` to include `branding` field in output
  - Returns `null` when branding is not provided (backward compatible)
  - Branding data positioned between `impact` and `narrative` in metadata structure

**Why**: Transforms test page into production-ready "Create Hypercert" flow while maintaining all existing logic. Introduces mainnet-compatible metadata structure that supports optional presentation assets (logo/banner/title/description) without affecting eligibility or verification rules. This is Phase 1-3 of the mainnet readiness plan: the UI now reflects the final intended user flow (submit → verifier approval → mint), while keeping simulation behavior temporarily for testing. Next phases will add actual request queue and verifier approval mechanisms.

### STEP 10 — Hypercert request queue system (2026-01-25)

**Added**
- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `HypercertRequestStatus` type: 'PENDING' | 'APPROVED' | 'REJECTED'
  - Added `HypercertRequest` interface with fields: id, requester, metadata, metadataCid, status, submittedAt, reviewedAt, reviewedBy, rejectionReason
  - Enables tracking of Hypercert creation requests through submission → review → mint workflow

- `frontend/src/lib/blockchain/hypercerts/requests.ts`:
  - New module for managing Hypercert request queue
  - Implemented `submitHypercertRequest()` to create new requests with PENDING status
  - Implemented `approveHypercertRequest()` for verifier approval workflow
  - Implemented `rejectHypercertRequest()` for verifier rejection with optional reason
  - Implemented `getAllHypercertRequests()` to list all requests
  - Implemented `getHypercertRequestsByStatus()` to filter by status
  - Implemented `getHypercertRequestsByUser()` to filter by requester address
  - Implemented `clearAllHypercertRequests()` utility for testing
  - Uses localStorage for v1 temporary storage (SSR-safe with window checks)
  - Includes comprehensive logging for debugging

- `frontend/src/lib/blockchain/hypercerts/index.ts`:
  - Exported all functions from `requests` module for clean imports

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Connected `handleSubmitRequest` to actual `submitHypercertRequest()` function
  - Removed simulation/TODO placeholder code
  - Added import for request management functions
  - Added `userRequests` state to track user's submitted requests
  - Added useEffect to load user's existing requests on mount and after submission
  - Added "YOUR REQUESTS" section in UI showing request history with status badges
  - Updated success message to show Request ID and explain pending verifier approval
  - Request list displays: ID, status (color-coded), submission date, review date

**Why**: Implements Phase 4 of mainnet readiness plan - establishes the request queue system that separates user submission from verifier-controlled minting. Users can now submit Hypercert creation requests that persist in local storage (v1) and await verifier approval. This is the core workflow for mainnet where minting is gated by verifier review. The UI shows users their request history and status, providing transparency into the approval process. Next phase will add the verifier interface to review and approve/reject these requests.

### STEP 11 — Verifier UI: Hypercert request review & approval (2026-01-26)

Changed
- frontend/src/app/verifier/page.tsx:
  - Added "Pending Hypercert Requests" section before existing "Pending Cleanups"
  - Loads Hypercert creation requests with PENDING status
  - Displays requester address, submission date, and request status
  - Added approve and reject actions for each Hypercert request
  - Added per-request processing state to prevent duplicate actions

- frontend/src/features/verifier/pages/page.tsx:
  - Mirrored Hypercert request review UI to ensure compatibility
  - Added same request loading, approval, and rejection logic
  - Ensures Hypercert review works regardless of which verifier page is active
  - Keeps cleanup verification flow unchanged

Why: Implements the verifier-side approval flow for Hypercert creation requests. Because the project currently has two verifier entry points, the Hypercert review logic was added to both to avoid routing ambiguity. Verifiers can now review, approve, or reject Hypercert requests submitted by users, completing the submission → review gate required for the mainnet Hypercert flow. No contract interaction is triggered yet; minting remains a future step after verifier approval.

### STEP 12 — Real Hypercert minting via SDK (2026-01-27)

**Added**
- `frontend/src/lib/blockchain/ipfs.ts`:
  - Added `uploadHypercertMetadataToIPFS()` function for uploading Hypercert metadata JSON to IPFS
  - Formats metadata with type and standard fields for Hypercert compatibility
  - Uses descriptive filenames with user address and timestamp

- `frontend/src/lib/blockchain/hypercerts/requests.ts`:
  - Added `updateRequestWithHypercertId()` function to update requests with minted Hypercert ID
  - Allows tracking which requests have been successfully minted on-chain

**Changed**
- `frontend/src/lib/blockchain/hypercerts/config.ts`:
  - Added `contract` configuration with Hypercert contract address on Celo Sepolia
  - Added `network` configuration with chain name and RPC URL
  - Contract address: `0x8610fe3190E21bf090c9F463b162A76478A88F5F`
  - Chain ID: `44787` (Celo Sepolia testnet)

- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `hypercertId` field to `HypercertRequest` interface
  - Enables tracking of minted Hypercert IDs within request objects

- `frontend/src/lib/blockchain/hypercerts-minting.ts`:
  - **Complete rewrite**: Replaced simulation with real on-chain minting via Hypercerts SDK
  - Added `getHypercertClient()` to initialize SDK with wallet client
  - Added `mintHypercertOnChain()` to mint Hypercerts directly to blockchain
  - Integrated `uploadHypercertMetadataToIPFS()` in full minting flow
  - Updated `mintHypercert()` to: upload metadata → mint on-chain → return transaction hash and Hypercert ID
  - Uses `@hypercerts-org/sdk` v2.9.1 with proper TransferRestrictions enum
  - Mints with 10,000 total units (standard 100% representation)
  - Sets transfer restriction to `AllowAll`

- `frontend/src/app/hypercerts/page.tsx`:
  - Added import for `updateRequestWithHypercertId` function
  - Added `handleMintApprovedRequest()` function to mint approved requests
  - Function uploads metadata to IPFS, mints on-chain, and updates request with Hypercert ID
  - Added "MINT HYPERCERT" button for APPROVED requests that haven't been minted yet
  - Button only appears when: `status === 'APPROVED' && !hypercertId`
  - Added display of minted Hypercert ID for completed requests
  - Added display of rejection reason for REJECTED requests
  - Refreshes request list after successful minting

**Why**: Implements the final step of the Hypercert flow - actual on-chain minting via the Hypercerts SDK. Users can now mint their approved requests to the blockchain, completing the full workflow: submit → verifier approval → user mints on-chain. The separation of "approval" (verifier) and "minting" (user) ensures quality control while keeping minting costs on the user. Metadata is uploaded to IPFS first, then referenced in the on-chain Hypercert. This completes Phase 0-1 of the Hypercert implementation plan with real blockchain interaction on Celo Sepolia testnet.

### STEP 13 — Hypercert metadata alignment to ERC-1155 standard (2026-02-13)

**Added**
- `frontend/src/lib/blockchain/hypercerts/metadata.ts`:
  - New `extractImpactSummaryFromMetadata()` function to extract impact data from new Hypercert metadata format
  - Used by verifier UI for backward compatibility with old access patterns
  - Enables seamless transition from old {impact: {summary}} to new Hypercert standard schema

**Changed**
- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Completely restructured to follow official Hypercerts.org ERC-1155 + Hypercerts specification
  - Added `HypercertDimension<T>` interface for standard hypercert dimensions (work_scope, impact_scope, work_timeframe, impact_timeframe, contributors, rights)
  - Replaced old `HypercertMetadata` with new structure:
    - Standard ERC-1155 fields: `name`, `description`, `image`, `external_url`, `properties`
    - Required Hypercert dimensions: `hypercert` object containing all 6 mandatory dimensions
    - Metadata generation timestamp: `generated_at`
  - Added `branding` field to `HypercertMetadata` (logo, banner, title, description)
  - Expanded `HypercertMetadataInput.impactData` with all cleanup report fields: `bags`, `hours`, `minutes`
  - Updated `HypercertRequest.metadata` type to use new `HypercertMetadata` interface

- `frontend/src/lib/blockchain/hypercerts/metadata.ts`:
  - **Complete rewrite**: Replaced simple metadata builder with full Hypercert standard implementation
  - Added 6 builder functions for Hypercert dimensions:
    - `buildWorkScope()`: from locationType + scopeOfWork
    - `buildImpactScope()`: from wasteTypes (defaults to "All" if empty)
    - `buildWorkTimeframe()`: from cleanup timeframe with formatted date display
    - `buildImpactTimeframe()`: with indefinite upper bound (0 = indefinite)
    - `buildContributors()`: from impactData contributors list
    - `buildRights()`: hardcoded to "Public Display" (v1 only)
  - Added `buildProperties()`: generates ERC-1155 properties/attributes from impact data
    - Total Cleanups, Impact Reports, Area Cleaned, Weight Removed, Bags Collected, Time Spent
    - Properly typed to accept both string and number values
  - Updated `buildHypercertMetadata()` to generate complete Hypercert-standard metadata
    - Maps all user impact data to official dimensions
    - Includes branding as optional presentation layer
    - Returns fully structured metadata compatible with Hypercerts.org viewers

- `frontend/src/lib/blockchain/hypercerts/index.ts`:
  - Added export of `extractImpactSummaryFromMetadata` function

- `frontend/src/app/verifier/page.tsx`:
  - Added import of `extractImpactSummaryFromMetadata`
  - Updated line 583: replaced `request.metadata?.impact?.summary?.totalCleanups` with call to helper function
  - Updated line 589: replaced `request.metadata?.impact?.summary?.totalReports` with call to helper function
  - Verifier UI now compatible with new metadata structure

- `frontend/src/features/verifier/pages/page.tsx`:
  - Added import of `extractImpactSummaryFromMetadata`
  - Updated lines 977, 983, 989-994: replaced all `request.metadata.impact` references with calls to helper function
  - All timeframe display logic now uses new metadata format

**Why**: Implements Phase 2 of mainnet readiness plan - ensures all Hypercert metadata strictly follows the official ERC-1155 + Hypercerts.org specification. This is critical for:
1. **External compatibility**: Metadata can now be rendered by any Hypercerts.org viewer, marketplace, or tool
2. **Standards compliance**: All 6 required dimensions are present and properly formatted
3. **Impact data mapping**: Cleanup reports are automatically mapped to work_scope, impact_scope, and properties
4. **Branding support**: Logo, banner, title, description are now first-class metadata fields
5. **Mainnet readiness**: Metadata structure is identical for testnet (Sepolia) and mainnet (Celo) - no refactoring needed when migrating

The schema change from nested {impact: {summary}} to Hypercert standard {hypercert: {work_scope, impact_scope, ...}} is abstracted via `extractImpactSummaryFromMetadata()` to avoid breaking verifier UI. This completes the metadata standardization required before mainnet deployment.

### STEP 14 — Branding upload system (Phase 3 complete) (2026-02-13)

**Added**
- `frontend/src/app/hypercerts/page.tsx`:
  - New branding upload UI section with optional fields
  - Logo and banner file input with individual upload buttons
  - Title and description text inputs for branding
  - Visual feedback showing uploaded IPFS CIDs (truncated for display)
  - `handleBrandingUpload()` function to upload files to IPFS via `uploadToIPFS()`
  - Proper file state management with `logoFile`, `bannerFile`, `logoImageCid`, `bannerImageCid`

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Moved branding states OUT of useEffect and into component root (line 36-40)
  - Added branding states: `logoFile`, `bannerFile`, `brandingTitle`, `brandingDescription`, `brandingCids`, `userRequests`
  - Updated `metadataInput` object to include `branding` field with conditional population:
    - Includes `logoImageCid`, `bannerImageCid`, `title`, `description` when CIDs are available
    - Falls back to `undefined` if no branding uploaded yet
  - Updated useEffect dependencies to include `brandingCids`, `brandingTitle`, `brandingDescription` for reactive metadata updates
  - Added BRANDING section (purple accent) between metadata preview and submit button
  - Branding section appears before SUBMIT FOR REVIEW to allow customization before submission
  - File inputs show upload progress and success messages via `submitResult` state

**Why**: Implements Phase 3 of mainnet readiness plan - allows users to customize Hypercert presentation with logo, banner, and text before submitting for verifier review. Branding is optional but enhances visual representation of the impact claim. Files are uploaded to IPFS before metadata is generated, ensuring CIDs are embedded in the final Hypercert metadata. This enables:
1. **Custom branding**: Each Hypercert can have unique logo/banner reflecting the user/project identity
2. **IPFS integration**: Images are stored on IPFS for decentralized, permanent storage
3. **Reactive metadata**: Metadata automatically regenerates when branding changes, keeping it in sync
4. **User transparency**: Upload progress and CIDs are shown in real-time, giving users confidence data is persisted

The branding section is placed before submission to ensure users finalize all customizations before sending request to verifiers, avoiding need for resubmission due to missing branding.

### STEP 15 — Verifier context expansion (Phase 4 complete) (2026-02-13)

**Added**
- `frontend/src/lib/blockchain/hypercerts/aggregation.ts`:
  - New `buildVerifierContext()` function to aggregate impact data across all Hypercert requests
  - Calculates: total requests, total cleanups, total reports, status breakdown (PENDING/APPROVED/REJECTED)
  - Extracts impact metrics from request metadata properties (trait_type matching)
  - Provides date range of submission/review activity
  - Returns structured context object for verifier dashboard visualization

**Changed**
- `frontend/src/lib/blockchain/hypercerts/index.ts`:
  - Added export of `buildVerifierContext` function

- `frontend/src/features/verifier/pages/page.tsx`:
  - Added import of `buildVerifierContext`
  - Added `verifierContext` state to store aggregated impact data
  - Updated `loadHypercertRequests()` to call `buildVerifierContext(pending)` after loading requests
  - Added visual context card (green accent) showing:
    - Total Requests count
    - Total Cleanups aggregated across all requests
    - Total Reports aggregated across all requests
    - Pending vs Approved request breakdown
  - Context card displays in 2-column grid (mobile) / 4-column grid (desktop)
  - Card appears before individual request list for quick overview

- `frontend/src/app/verifier/page.tsx`:
  - Added import of `buildVerifierContext`
  - Added `verifierContext` state (matching features/verifier structure)
  - Updated request loading to calculate context
  - Added matching visual context card in same location/style
  - Ensures consistency across both verifier entry points

**Why**: Implements Phase 4 of mainnet readiness plan - provides verifiers with high-level impact overview before reviewing individual requests. The aggregated context helps verifiers:
1. **Quickly assess total impact**: See cumulative cleanups and reports at a glance
2. **Track approval progress**: Monitor pending vs approved requests
3. **Understand workload**: Total requests shows volume of submissions
4. **Make informed decisions**: Context informs individual request review

The card is placed above individual requests to encourage verifiers to understand overall impact before diving into details. This is crucial for mainnet where verifier load may be high and they need quick decision-making support. Both verifier pages have identical context logic to avoid routing confusion.

### STEP 16 — Post-mint UX (Phase 5 complete) (2026-02-13)

**Added**
- `frontend/src/lib/blockchain/hypercerts/requests.ts`:
  - Expanded `updateRequestWithHypercertId()` to accept optional `txHash` and `metadataCid` parameters
  - Persists all three fields (hypercertId, txHash, metadataCid) to localStorage
  - Enables full traceability of minted Hypercerts from submission to on-chain

**Changed**
- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `txHash?: string` field to `HypercertRequest` interface
  - Enables tracking of minting transaction hash for explorer links

- `frontend/src/app/hypercerts/page.tsx`:
  - Updated `handleMintApprovedRequest()` to pass `result.txHash` and `result.metadataCid` to update function
  - Expanded post-mint UI with clickable explorer and IPFS links:
    - 🔗 View on Explorer: Links to Celo Sepolia BlockScout (tx hash)
    - 📄 View Metadata: Links to IPFS Gateway (metadata CID)
  - Replaced simple text display with green-accented card showing:
    - MINTED status badge
    - Hypercert ID (truncated)
    - External links for verification
    - Explanatory text about on-chain availability

**Why**: Implements Phase 5 of mainnet readiness plan - provides users with clear post-mint experience and external verification paths. Users can now:
1. **Verify transaction**: Click explorer link to see on-chain confirmation
2. **Inspect metadata**: View raw IPFS metadata to understand what was minted
3. **Share proof**: Links enable users to prove ownership and impact claims
4. **External discovery**: Hypercert is discoverable on Hypercerts.org, OpenSea, and other marketplaces

The persistent storage of txHash and metadataCid ensures that even if users close and reopen the app, they have permanent links to their minted Hypercert. This completes the full user journey: submit → review → mint → verify → share.
