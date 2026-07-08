# DMRV helpers

Implementation for ML pre-screening lives here. Product flow and deployment: **`docs/ML_VERIFICATION_ARCHITECTURE.md`**.

| Module | Role |
|--------|------|
| `gpu-verification.ts` | Orchestrates GPU calls + scoring |
| `ml-integration.ts` | Pipeline orchestration helper (currently unused) |
| `onchain-hash.ts` | Store verification hash onchain (currently unused) |

Active API: **`POST /api/ml-verification/verify`**.
