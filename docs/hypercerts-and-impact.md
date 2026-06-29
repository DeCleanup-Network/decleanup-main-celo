# Hypercerts & Impact Data Pipeline

This document explains how the DeCleanup dashboard builds Hypercerts, why we collect detailed impact forms, and how rewards tie to verified impact.

## Impact reporting flow

1. **Cleanup submission** — User uploads before/after photos + location.
2. **Impact form (optional but encouraged)** — Weight removed, area covered, time spent, waste types, context notes, contributors, challenges, prevention ideas.
3. **Recyclables add-on** — Photo / receipt hash if materials were recycled.
4. **Submission approval** — Verifier/Admin approves, triggering:
   - `userCleanupCount++`
   - Impact form rewards via `rewardImpactReports`
   - Recyclables: 5 DCU in same bucket as impact form (no separate contract)
   - Hypercert eligibility check (every 10 verified cleanups)

Why collect the impact form?

- Hypercert metadata needs more than photos — it captures quantifiable metrics for long-term certificates.
- Data feeds SDG reporting, corporate ESG dashboards, and future impact marketplaces.
- Aggregated stats (weight/area/hours) make Hypercerts meaningful and comparable across cohorts.

## Hypercert publish flow (AT Protocol)

When AT publishing is enabled (`HYPERCERTS_AT_ENABLED`), certificates are published to the org ATProto repository and indexed on Hyperscan — not minted by the user in the browser.

```
Cleanup approvals ➀➁➂ … ➉ ──▶ User opens /hypercerts ──▶ Submit signed request (PENDING)
                                                                        │
Verifier approves ──────────────────────────────────────────────────────┘
        │
        ▼
Server: aggregate data → IPFS assets → ATProto records (activity, measurements, evidence, evaluation)
        │
        ▼
Request updated with at:// URI ──▶ User notified on next app visit (Hyperscan link)
```

1. **Eligibility** — UI uses `hypercerts/eligibility.ts` thresholds (10 verified cleanups in production; optional relaxed mode for testing).
2. **Data aggregation** (`lib/blockchain/hypercerts/aggregation.ts` and related modules):
   - Fetch each cleanup via `getCleanupDetails`.
   - Fetch impact form JSON from IPFS (`impactFormDataHash`) with multi-gateway retries.
   - Normalize units (kg/lb→kg, sqft/sqm→sqm, minutes/hours) and sum totals.
   - Collect waste types, contributors, challenges, prevention ideas, and before/after photo hashes.
3. **Image generation** (`lib/utils/hypercert-image-generator.ts`):
   - Collage of before/after shots (or fallback to best after photo).
   - Banner with gradient + stat tiles.
   - Logo with level badge + DeCleanup branding.
   - Upload each canvas result to IPFS via the Pinata proxy.
4. **Metadata build** (`lib/blockchain/hypercerts/metadata.ts`):
   - Constant traits: Type, Impact category, Level, Hypercert #.
   - Dynamic traits: Cleanups aggregated, weight removed, area covered, hours worked, waste categories, contributors count, location anchors.
   - External links: Impact Product on CeloScan, leaderboard, docs.
   - `image` & `external_url` point to IPFS hashes from step 3.
5. **AT publish** (`atproto-publish.ts`, `atproto/mapper.ts`):
   - Map DeCleanup metadata to `org.hypercerts.claim.*` lexicons.
   - Upload cover blob for Hyperscan display (`activity-cover.ts`).
   - Write records via org app password on configured PDS.
6. **Reward (optional Celo path)** — If the legacy minter flow is used, `claimHypercertReward(hypercertNumber)` on `DCURewardManager` accrues the configured **DCU bonus** into the user’s onchain participation balance.

For a concise engineering summary and file paths, see **`docs/HYPERCERTS.md`**.

## Error handling

- **IPFS fetch/upload**: `fetchWithRetries` hits multiple gateways; upload route returns descriptive errors.
- **Image generation**: Fallback to latest after photo if canvas fails.
- **AT publish**: Errors stored on the request; verifier UI may show a publish warning while approval still succeeds.
- **Legacy mint**: Granular error classes (`HypercertMintingError`, `IPFSError`, `ContractError`, `SDKError`) bubble up to the UI toast.
- **Reward claim**: If Hypercert reward fails (e.g., user already claimed), we show success for mint but log reward failure separately so user can retry.

## Future enhancements

- Locations/rights as first-class AT records.
- Portfolio `hypercerts[]` fully synced from published `at://` URIs.
- Optional dual-write or on-chain anchor when Hypercerts IdentityLink matures.

For a diagram of how this integrates with the rest of the system, see **`docs/system-architecture.md`**.
