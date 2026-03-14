# Hypercerts & Impact Data Pipeline

This document explains how the Celo dashboard generates Hypercerts, why we collect detailed impact forms, and how rewards are tied to verified impact.

## Impact reporting flow

1. **Cleanup submission** – User uploads before/after photos + location.
2. **Impact form (optional but encouraged)** – Weight removed, area covered, time spent, waste types, context notes, contributors, challenges, prevention ideas.
3. **Recyclables add-on** – Photo / receipt hash if materials were recycled.
4. **Submission approval** – Verifier/Admin approves, triggering:
   - `userCleanupCount++`
   - Impact form rewards via `rewardImpactReports`
   - Recyclables: 5 DCU in same bucket as impact form (no separate contract)
   - Hypercert eligibility check (every 10 cleanups)

Why collect the impact form?
- Hypercert metadata needs more than photos—it captures quantifiable metrics for long-term certificates.
- Data feeds SDG reporting, corporate ESG dashboards, and future impact marketplaces.
- Aggregated stats (weight/area/hours) make Hypercerts meaningful and comparable across cohorts.

## Hypercert minting steps

```
Cleanup approvals ➀➁➂ … ➉ ──▶ Frontend aggregates data ──▶ Hypercert metadata/imgs ──▶ Hypercerts SDK mint
                                                                                         │
                                                                                         └─▶ claimHypercertReward (10 $DCU)
```

1. **Eligibility** – `Submission.sol` emits `HypercertEligible` when `userCleanupCount % 10 == 0`.
2. **Data aggregation** (`lib/blockchain/hypercerts-data.ts`):
   - Fetch each cleanup via `getCleanupDetails`.
   - Fetch impact form JSON from IPFS (`impactFormDataHash`) with multi-gateway retries.
   - Normalize units (kg/lb→kg, sqft/sqm→sqm, minutes/hours) and sum totals.
   - Collect waste types, contributors, challenges, prevention ideas, and before/after photo hashes.
3. **Image generation** (`lib/utils/hypercert-image-generator.ts`):
   - **Collage** of before/after shots (or fallback to best after photo).
   - **Banner** with gradient + stat tiles.
   - **Logo** with level badge + DeCleanup branding.
   - Upload each canvas result to IPFS via the same Pinata proxy.
4. **Metadata build** (`hypercerts-metadata.ts`):
   - Constant traits: Type, Impact category, Level, Hypercert #.
   - Dynamic traits: Cleanups aggregated, weight removed, area covered, hours worked, waste categories, contributors count, location anchors.
   - External links: Impact Product on CeloScan, leaderboard, docs.
   - `image` & `external_url` point to IPFS hashes from step 3.
5. **Mint** (`hypercerts-minting.ts`):
   - Upload metadata JSON to IPFS first (so token references live hash).
   - Use `HypercertClient.mintClaim` with `TransferRestrictions.FromCreatorOnly`.
   - Await tx receipt and surface hyperlink to `hypercerts.org/app/view/<txHash>`.
6. **Reward** – Call `claimHypercertReward(hypercertNumber)`:
   - Contract confirms `userHypercertCount >= hypercertNumber`.
   - Prevents double rewards via `hypercertRewardsClaimed`.
   - Accrues 10 $DCU into the user’s balance.

## Error handling

- **IPFS fetch/upload**: `fetchWithRetries` hits multiple gateways; upload route returns descriptive errors.
- **Image generation**: Fallback to latest after photo if canvas fails.
- **Hypercert mint**: Granular error classes (`HypercertMintingError`, `IPFSError`, `ContractError`, `SDKError`) bubble up to the UI toast.
- **Reward claim**: If Hypercert reward fails (e.g., user already claimed), we show success for mint but log reward failure separately so user can retry.

## Future enhancements

- Automated listener that detects Hypercert mint events and calls `rewardHypercertMint`/`claimHypercertReward` server-side (optional).
- Shareable Hypercert previews embedded in the dashboard once minted.
- Bulk mint support for ambassadors (multiple cohorts at once).

For a diagram of how this integrates with the rest of the system, see `docs/system-architecture.md`.

