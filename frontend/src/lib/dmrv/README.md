# DMRV helpers

Implementation for ML pre-screening lives here. Product flow and deployment: **`docs/ML_VERIFICATION_ARCHITECTURE.md`**.

| Module | Role |
|--------|------|
| `gpu-verification.ts` | Orchestrates GPU calls + scoring |
| `ml-integration.ts` | Client helper → `/api/ml-verification/verify` |
| `integration.ts` | Legacy → `/api/dmrv/verify` |

Active API: **`POST /api/ml-verification/verify`**.
