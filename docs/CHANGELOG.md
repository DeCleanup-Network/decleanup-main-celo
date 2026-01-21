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