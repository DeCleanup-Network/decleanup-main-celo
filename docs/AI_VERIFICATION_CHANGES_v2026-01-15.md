# AI Verification Scoring Logic Update

**Date**: January 15, 2026
**Branch**: AI-verification
**Status**: Implemented (Manual Changes Applied)

## Summary

Updated AI verification scoring logic to improve accuracy and safety while maintaining advisory-only behavior. Changes focus on equal weighting between confidence and delta metrics, with stability checks to prevent false approvals of potentially mismatched photo pairs.

## Changes Made

### 1. Scoring Formula Update

**File**: `frontend/src/lib/dmrv/gpu-verification.ts`
**Function**: `computeVerificationScore()`

**Before**:
```typescript
const score = (meanConfidence * 0.4) + (normalizedTrashDelta * 0.6)
```

**After**:
```typescript
const score = (meanConfidence * 0.5) + (normalizedTrashDelta * 0.5)
```

**Rationale**: Equal weighting (50/50) reduces over-reliance on potentially noisy delta calculations and gives confidence equal importance in determining verification quality.

### 2. Stability-Aware Verdict Logic

**Replaced old threshold-based logic with stability checks**:

**Before**:
```typescript
let verdict: 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED'
if (score >= 0.5) {
  verdict = 'AUTO_VERIFIED'
} else if (score >= 0.25) {
  verdict = 'NEEDS_REVIEW'
} else {
  verdict = 'REJECTED'
}

if (beforeCount > 0 && afterCount < beforeCount && delta > 0) {
  if (verdict === 'REJECTED') {
    verdict = 'NEEDS_REVIEW'
  }
}
```

**After**:
```typescript
const confidenceVariance = Math.abs(beforeResult.meanConfidence - afterResult.meanConfidence)
const isStable = confidenceVariance < 0.15

let verdict: 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED'

if (score >= 0.6) {
  verdict = 'AUTO_VERIFIED'
} else if (score >= 0.3) {
  verdict = 'NEEDS_REVIEW'
} else {
  verdict = 'REJECTED'
}

if (verdict === 'AUTO_VERIFIED' && !isStable && delta >= 0) {
  verdict = 'NEEDS_REVIEW'
}

if (verdict === 'REJECTED' && delta > 0) {
  verdict = 'NEEDS_REVIEW'
}
```

**Key Logic Changes**:
- **Stability threshold**: Confidence variance < 0.15 for stable detections
- **AUTO_VERIFIED override**: Unstable high-scorers downgraded to NEEDS_REVIEW
- **Positive delta protection**: Cleanups with positive delta cannot be rejected (always upgraded to NEEDS_REVIEW)
- **Raised thresholds**: 0.6/0.3 instead of 0.5/0.25 for stricter auto-approval
- **REJECTED remains advisory**: AI may return REJECTED verdict but it never blocks user/verifier actions

### 3. Interface Updates

**Added optional fields to VerificationScore interface**:
```typescript
export interface VerificationScore {
  // ... existing fields
  confidenceVariance?: number // For debugging/transparency
  isStable?: boolean // For debugging/transparency
}
```

**Return payload now includes confidenceVariance and isStable (optional fields)** for transparency. The `computeVerificationScore()` function now returns these values in the result object, allowing downstream consumers to access stability information.

## Test Scenarios Validation

All scenarios behave as intended with new logic:

### Scenario A: Valid cleanup with lighting variance
**Inputs**: beforeCount=12, afterCount=3, beforeConf=0.75, afterConf=0.45
**Result**: NEEDS_REVIEW (protected from rejection, flagged for review due to instability)
**Why correct**: Valid cleanup gets human review instead of rejection despite lighting differences.

### Scenario B: Invalid submission with angle change
**Inputs**: beforeCount=8, afterCount=15, beforeConf=0.8, afterConf=0.75
**Result**: NEEDS_REVIEW (cannot auto-approve invalid submissions)
**Why correct**: Suspicious submissions require human review.

### Scenario C: High-quality cleanup
**Inputs**: beforeCount=25, afterCount=2, beforeConf=0.85, afterConf=0.82
**Result**: AUTO_VERIFIED (stable, high score, positive delta)
**Why correct**: Excellent cleanups maintain auto-approval status.

### Scenario D: Positive delta protection
**Inputs**: beforeCount=2, afterCount=1, beforeConf=0.2, afterConf=0.2
**Result**: NEEDS_REVIEW (protected from rejection despite low score)
**Why correct**: Any positive delta cleanup gets human review instead of rejection.

## Safety Confirmations

✅ **Advisory-only**: AI results are suggestions, not final decisions
✅ **Non-blocking**: Submissions succeed regardless of AI status
✅ **Human sovereignty**: Verifiers can override all AI verdicts
✅ **Advisory REJECTED**: AI may return REJECTED but it is advisory-only and never blocks submission/claim/verifier actions
✅ **No auto-approval**: AI cannot approve submissions for rewards
✅ **Feature isolation**: Can be disabled without breaking core flow

## Technical Details

### Scoring Components Unchanged
- Delta normalization: maxDelta=50, negative penalty cap=-0.3
- Mean confidence calculation: (before + after) / 2
- Hash generation: SHA256 of full result object

### Thresholds Summary
- **AUTO_VERIFIED**: score ≥ 0.6 AND variance < 0.15 AND delta ≥ 0
- **NEEDS_REVIEW**: score 0.3-0.6, OR unstable high-scorers, OR protected positives
- **REJECTED**: score < 0.3 AND delta ≤ 0 (rare edge cases only) - **advisory only, never blocks actions**

### Performance Impact
- Minimal: Added variance calculation (simple math)
- Memory: No significant increase
- Compatibility: Return object backward compatible (new fields optional)

## Testing Performed

- ✅ TypeScript compilation successful
- ✅ Build passes without errors
- ✅ Existing tests pass
- ✅ Manual scenario testing confirms expected behavior
- ✅ AI disabled mode preserves full functionality
- ✅ AI failure mode allows submissions to proceed

## Files Modified

1. `frontend/src/lib/dmrv/gpu-verification.ts`
   - Updated computeVerificationScore function
   - Added stability calculations
   - Modified verdict logic
   - Extended interface with optional fields

## Dependencies

- No new external dependencies added
- No contract changes required
- No database schema changes
- Backward compatible with existing API consumers

## Rollback Plan

If issues arise:
1. Revert `computeVerificationScore` function to previous version
2. Remove optional interface fields
3. Restart services
4. No data migration needed (results stored as-is)

## Future Improvements

- Consider adding confidence variance to UI display
- Monitor false positive/negative rates in production
- Potentially adjust stability threshold (0.15) based on real data
- Consider per-verifier AI visibility preferences

---

**Implementation completed by**: AI Assistant (manual changes applied)
**Review status**: Ready for testing
**Production readiness**: ✅ Safe for deployment