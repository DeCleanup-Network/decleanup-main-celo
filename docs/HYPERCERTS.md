# Hypercerts (impact certificates)

**Last reviewed:** June 2026

Eligible users can publish **Hypercerts** — verifiable impact certificates built from aggregated cleanup and impact data. Production publishing uses the **AT Protocol** lexicons (`org.hypercerts.claim.*`) and appears on **[Hyperscan](https://hyperscan.hypercerts.org/)** when `HYPERCERTS_AT_ENABLED` is set. Legacy **Celo minter** code remains in the repo for optional on-chain mint and DCU bonus claims.

## Where to read more

| Audience | Document |
|----------|----------|
| Product / pipeline | **`docs/hypercerts-and-impact.md`** |
| Architecture context | **`docs/system-architecture.md`** (Hypercerts section) |
| AT Protocol direction | **`docs/HYPERCERTS_ATPROTO_RESEARCH.md`** |
| Developers (APIs, env) | **`docs/DEVELOPERS.md`** (Hypercerts section) |
| End users | **`/guide`** in the app, [hypercerts.org](https://hypercerts.org/) |

## User flow (production)

1. User opens **`/hypercerts`** from the dashboard cabinet (same row as Leaderboard and Verifier).
2. After **10 verified cleanups** (or relaxed threshold in test), user configures branding and submits a **request** (signed message).
3. A **verifier** approves or rejects in the Verifier Cabinet.
4. On approve, the **server** publishes ATProto records (activity, measurements, evidence, evaluation) to the org PDS and stores the `at://` URI on the request.
5. User sees status in the Hypercerts hub; a **one-time modal** on next app visit links to Hyperscan when publish completes.

Users do **not** self-publish from the UI — publishing is server-side after verifier approval.

## Code map

| Topic | Location |
|--------|-----------|
| Eligibility | `frontend/src/lib/blockchain/hypercerts/eligibility.ts`, `config.ts` |
| Aggregation / metadata | `aggregation.ts`, `metadata.ts` |
| Request submit + signing | `requests.ts`, `request-signing.ts`, `frontend/src/app/api/hypercerts/requests/` |
| Verifier review + auto-publish | `frontend/src/app/api/hypercerts/requests/review/route.ts` |
| AT publish orchestration | `atproto-publish.ts`, `atproto/client.ts`, `atproto/mapper.ts` |
| Cover image for Hyperscan | `atproto/activity-cover.ts` |
| Publish notification (modal) | `publish-notification.ts`, `HypercertPublishedNotifier.tsx` |
| UX | `frontend/src/app/hypercerts/page.tsx` |
| Legacy Celo mint | `hypercerts-minting.ts`, `POST /api/hypercerts/requests/mint` |
| On-chain DCU bonus | `DCURewardManager.claimHypercertReward` (when Celo mint path is used) |
| Supabase | `hypercert_requests` table, `frontend/src/lib/supabase/hypercert-requests-db.ts` |

## Environment (AT publish)

See `frontend/.env.example` and `frontend/ENV_TEMPLATE.md`. Key server vars:

- `HYPERCERTS_AT_ENABLED=true`
- `NEXT_PUBLIC_HYPERCERTS_AT_ENABLED=true`
- `HYPERCERTS_ATPROTO_HANDLE`, `ATPROTO_APP_PASSWORD`, `HYPERCERTS_ATPROTO_DID`

### PDS / login service (important)

Hypercerts can publish from **any** AT Protocol PDS. The login service must match the account’s **home PDS**:

| Account | Login / PDS |
|---------|-------------|
| Bluesky handle (e.g. `decleanup.bsky.social`) | `https://bsky.social` — set `HYPERCERTS_ATPROTO_PDS_URL` or leave unset (auto-detect) |
| `*.certified.one` handle | `https://certified.one` |
| Certified staging | `HYPERCERTS_ATPROTO_LOGIN_SERVICE=https://dev.certified.app` |

`HYPERCERTS_ATPROTO_LOGIN_SERVICE` overrides `HYPERCERTS_ATPROTO_PDS_URL` when both are set. **Do not remove `HYPERCERTS_ATPROTO_PDS_URL` only because you use Bluesky** — keep it when you want explicit config (`https://bsky.social`).

Diagnostics: `GET /api/hypercerts/requests/publish` (ops auth in production).

## Rollout checklist

| Step | Action | Notes |
|------|--------|--------|
| 1 | **Deploy** `activity-cover.ts` (smallImage) | Already in `publishActivity` → `hydrateActivityCoverImage` |
| 2 | **Re-publish** existing certificates | Verifier Cabinet → **Published Hypercerts** → **Re-publish (cover fix)**; or `POST /api/hypercerts/requests/atproto-publish` with `force: true` |
| 3 | Verify on Hyperscan | Cover should render via `org.hypercerts.defs#smallImage` blob |
| 4 (optional) | Staging login | `HYPERCERTS_ATPROTO_LOGIN_SERVICE=https://dev.certified.app` |
| 5 (optional) | `locations[]` from cleanup GPS | `app.certified.location` — not yet implemented |
| 6 (optional) | `rights` as AT strongRef | Currently IPFS metadata only |
| 7 (optional) | Hyperindex API | Hyperscan federates automatically |
| 8 (optional) | Labelers | Moderation / ecosystem — not required to publish |

**Proposed next-gen portal UI** (Green Goods Admin review): **`docs/HYPERCERTS_PORTAL_PROPOSED_UI.md`**.
