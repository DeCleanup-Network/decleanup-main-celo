# Hypercerts Integration — Implementation Decisions

**Date**: January 2025  
**Status**: Approved for Phase 0-5 Implementation

---

## Context

Hypercerts integration was previously disabled/removed from the codebase to focus on core functionality. This document provides explicit decisions for the new, conservative implementation approach proposed by the development team.

**Current State**: Hypercerts are intentionally disabled. Helper code exists but minting is not wired into production flows.

**Goal**: Implement Hypercerts as a credible, auditable impact aggregation layer without blocking core cleanup → verification → reward flows.

---

## Decision 1: Aggregation Model

**Decision**: **Per User Aggregation** (v1)

**Rationale**:
- Simplest to implement and verify
- Clear ownership and attribution
- Aligns with existing `userHypercertCount` tracking in `Submission.sol`
- Users can see their own aggregated impact certificates
- No complex multi-user coordination needed in v1

**Implementation**:
- One Hypercert = aggregated impact of N verified cleanups from a single user
- Default: N = 10 (aligns with existing `userHypercertCount` logic)
- Configurable threshold for v1 (can be adjusted per mint)

**Future Considerations**:
- Campaign-based aggregation (Phase 2+)
- Regional aggregation (Phase 2+)
- Hybrid models (Phase 3+)

**Metadata Field**: `aggregation_type: "user"`

---

## Decision 2: Mint Authority

**Decision**: **User-Initiated Minting** (with on-chain eligibility check)

**Rationale**:
- UI already exists where users press "MINT" button on dashboard
- Users mint their own Hypercerts (self-service model)
- Eligibility is enforced on-chain (10+ verified cleanups required)
- Verifiers focus on their core mission: verifying cleanups
- No need for verifier involvement in minting process

**Implementation**:
- Users mint Hypercerts via their own wallet (they sign the transaction)
- Eligibility checked via `getHypercertEligibility()` before showing "MINT" button
- Minting function automatically aggregates user's last 10 verified cleanups
- User signs transaction to mint on-chain via Hypercerts SDK
- System automatically claims 10 $DCU reward after successful mint

**Security**:
- Eligibility enforced on-chain (cannot mint without 10 verified cleanups)
- User must sign transaction (wallet confirmation required)
- All cleanups must be verified (checked during aggregation)

**Verifier Role**:
- Verifiers verify cleanups (approve/reject submissions) - their core mission
- Verifiers do NOT mint Hypercerts - that's a user action
- Verifiers can view Hypercert information (read-only) if needed in future

**Future Considerations**:
- Admin override for special cases (if needed)
- Batch minting for campaigns (Phase 2+)

---

## Decision 3: Minimum Minting Rules

**Decision**: **Minimum 10 Verified Cleanups** (configurable per mint)

**Rationale**:
- Aligns with existing `userHypercertCount` logic in contracts
- Ensures meaningful aggregation (not single cleanup certificates)
- Provides clear threshold for users
- Allows flexibility for special cases (admin can override)

**Implementation**:
- Default minimum: 10 verified cleanups
- Verifier can specify exact cleanup IDs to include (must be ≥ 10)
- All specified cleanups must be verified (status check)
- Time window: No restriction in v1 (manual selection)
- Admin can mint with fewer cleanups for special cases (documented)

**Metadata Field**: `minimum_threshold: 10`, `cleanup_count: <actual_count>`

**Future Considerations**:
- Time-based windows (e.g., "last 30 days")
- Campaign-specific thresholds
- Quality-based thresholds (e.g., minimum impact score)

---

## Decision 4: Metadata Strictness

**Decision**: **Conservative with Narrative Context** (verified facts + honest context)

**Rationale**:
- Maintains credibility and auditability
- Allows meaningful storytelling without speculation
- Balances technical accuracy with human readability

**Implementation**:
- **Required (Verified Facts)**:
  - `cleanup_ids`: Array of verified cleanup IDs (on-chain)
  - `total_items_removed`: Sum from impact forms (if available)
  - `verification_method`: "human" or "human_assisted" (no AI claims in v1)
  - `timeframe`: Start/end timestamps from first/last cleanup
  - `issuer`: "DeCleanup Network"
  - `version`: "v1"
  
- **Optional (Narrative Context)**:
  - `description`: Human-readable summary (honest, no speculation)
  - `locations`: Coarse geographic info (city/region, no PII)
  - `waste_types`: Aggregated from impact forms (if available)
  - `challenges`: Common themes from impact forms (if available)
  - `prevention_ideas`: Aggregated suggestions (if available)

**Rules**:
- No AI-generated claims
- No speculative metrics (e.g., "prevented X kg of future waste")
- No auto-calculated "hours" unless explicitly provided in impact forms
- All numbers must be traceable to verified cleanups
- Narrative must be honest and clearly marked as context, not fact

**Metadata Field**: `metadata_strictness: "conservative_with_context"`

---

## Implementation Phases (Confirmed)

### Phase 0 — Repository & Flow Analysis ✅
- Map cleanup lifecycle
- Identify aggregation points
- Audit existing helpers
- Confirm no reward dependencies

### Phase 1 — Hypercert Scope Definition ✅
- **Aggregation**: Per user
- **Trigger**: Manual verifier mint
- **Minimum**: 10 verified cleanups
- **No automation**: Explicit cleanup ID selection

### Phase 2 — Metadata Schema (v1) ✅
- **Schema**: Conservative with narrative context
- **Fields**: See Decision 4 above
- **Example**: Generate and pin to IPFS

### Phase 3 — Backend / Script-Level Minting
- Mint script using Hypercerts SDK
- Inputs: cleanup IDs, metadata CID, verifier address
- Logging and audit trail

### Phase 4 — Verifier Visibility (Read-Only UI)
- Show Hypercert references in verifier dashboard
- "This cleanup was included in Hypercert X"
- Link to Hypercert explorer

### Phase 5 — User Visibility (Read-Only)
- Profile page: "Impact Certificates"
- List Hypercerts linked to user's cleanups
- External links only

---

## Out of Scope (Confirmed)

- ❌ Automatic Hypercert minting
- ❌ AI-triggered minting
- ❌ Reward multipliers based on Hypercerts
- ❌ Governance or voting rights tied to Hypercerts
- ❌ On-chain aggregation logic
- ❌ Upgradeable/proxy Hypercert contracts

These remain candidates for future milestones.

---

## Success Criteria (Confirmed)

- ✅ Hypercerts can be minted reliably
- ✅ No impact on core cleanup/reward flows
- ✅ Verifiers understand what Hypercerts represent
- ✅ No user confusion or false expectations
- ✅ Clean upgrade path for future automation

---

## Next Steps

1. **Developer**: Update implementation plan with these decisions
2. **Developer**: Begin Phase 0 (Repository & Flow Analysis)
3. **Team**: Review Phase 0 deliverables before Phase 1
4. **Team**: Test Phase 3 (mint script) on testnet before UI work

---

## Notes

- All decisions are for **v1 only** and can be extended in future phases
- Manual minting ensures quality and prevents automation errors
- Conservative metadata maintains credibility while allowing narrative
- Per-user aggregation is simplest and most verifiable
- Verifier role provides trust without single point of failure

---

**Approved By**: Project Lead  
**Implementation Start**: Pending Phase 0 completion
