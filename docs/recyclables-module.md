# Recyclables step (optional)

The recyclables add-on is **optional**. Users who document recycling (photo + receipt hash) get **5 DCU points** in the same bucket as the impact form: one call to `rewardImpactReports(submitter, 1)` per submission when the user has either impact form or recyclables (or both). No separate reward and no RecyclablesReward contract.

- **UI:** Cleanup flow includes an optional “Recyclables” step (photo + receipt). The step is always available (no feature flag).
- **On-chain:** Submission stores `hasRecyclables`, `recyclablesPhotoHash`, `recyclablesReceiptHash`. On approval, if `hasImpactForm || hasRecyclables`, the contract calls `rewardManager.rewardImpactReports(s.submitter, 1)` once (5 DCU total for that submission).
- **Claim:** DCU points (including from impact/recyclables) feed into the $cDCU claim formula as before.
