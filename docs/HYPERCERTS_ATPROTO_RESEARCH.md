# Hypercerts AT Protocol — research & adoption notes (DeCleanup)

**Last updated:** June 2026  
**Audience:** DeCleanup engineering / product decisions  
**Related:** `docs/HYPERCERTS.md`, `docs/hypercerts-and-impact.md`, `frontend/src/lib/blockchain/hypercerts/`

---

## On this page

| Section | Jump |
|---------|------|
| [Executive summary](#executive-summary) | What changed, what we should do |
| [Where Hypercerts is going](#where-hypercerts-is-going) | AT Protocol vs old EVM |
| [What DeCleanup uses today](#what-decleanup-uses-today) | Current v0.1 stack |
| [AT data model](#at-protocol-data-model) | Lexicons & records |
| [Field mapping](#mapping-decleanup-metadata--at-activity) | Old metadata → AT |
| [Integration options](#integration-options-for-decleanup) | PDS, SDS, hybrid |
| [Next steps](#next-steps-to-adapt-at-protocol) | Ordered action list |
| [Research plan](#research-plan) | What to read and prototype |
| [Migration phases](#migration-phases) | Low-risk rollout |
| [Recommendation](#recommendation) | What to keep vs change |

---

## Executive summary

Hypercerts **redesigned in 2025–2026**. The canonical hypercert is no longer “mint an ERC-1155 on EVM first.” It is a **graph of ATProto lexicon records** (`org.hypercerts.claim.activity` + measurements, evidence, rights, evaluations) stored in user or org repositories, with **optional on-chain anchoring** for ownership and funding.

**DeCleanup today** publishes impact certificates via **AT Protocol** when enabled (verifier-approved requests → org PDS → Hyperscan). Legacy **Celo minter** code (`@hypercerts-org/sdk` v2.9.1) remains for optional on-chain mint and `claimHypercertReward` DCU bonuses.

**Next move:** extend AT records (locations, rights), sync portfolio from `at://` URIs, and evaluate optional on-chain anchor when IdentityLink matures.

---

## Where Hypercerts is going

| Layer | Hypercerts v0.1 (EVM) | Hypercerts v0.2+ (ATProto) |
|-------|----------------------|----------------------------|
| Primary data | IPFS JSON + on-chain mint | ATProto repo records |
| Identity | Wallet (EOA / Safe) | ATProto DID (+ **IdentityLink** to EVM, WIP) |
| Cost to publish | Gas + wallet | No gas for record writes on PDS/SDS |
| Evidence | IPFS blobs | PDS blobs + `evidence` / `measurement` records |
| Interop | Chain-specific viewers | Any app reading same lexicons (AppView / Hyperindex) |
| Tokens / funding | On-chain mint | Optional on-chain anchor + tokenization (WIP) |

**Official framing:** [Why AT Protocol?](https://docs.hypercerts.org/core-concepts/why-at-protocol) — rich impact data on ATProto; chains for settlement/ownership when needed.

**Strategy context:** [Hypercerts Adoption Strategy Memo 2026](https://gist.github.com/holkexyz/6fb79cdc7c3db8e9093e1ad93892db15) — directional shift from “onchain token standard first” to “shared data layer first.”

**SDK warning:** `@hypercerts-org/sdk-core` is marked **unmaintained / do not use** for ATProto. Recommended stack: `@hypercerts-org/lexicon` + `@atproto/api`. Reference app: [hypercerts-scaffold-atproto](https://github.com/hypercerts-org/hypercerts-scaffold-atproto).

---

## What DeCleanup uses today (June 2026)

| Piece | Location |
|-------|----------|
| Primary publish (prod) | `atproto-publish.ts` → `org.hypercerts.claim.*` on org PDS → Hyperscan |
| AT client | `atproto/client.ts` — `@atproto/api` + org app password |
| Metadata / mapping | `hypercerts/metadata.ts`, `atproto/mapper.ts` |
| Config | `hypercerts/config.ts` — AT env + optional Celo minter `0x16bA53B74c234C870c61EFC04cD418B8f2865959` |
| UX | `/hypercerts` — request → verifier approve → **server auto-publish** |
| Notifications | `HypercertPublishedNotifier.tsx` — one-time modal with Hyperscan link |
| Legacy EVM mint | `hypercerts-minting.ts` → `mintClaim` on Celo (optional) |
| Reward | `DCURewardManager.claimHypercertReward` (DCU ledger bonus when mint path used) |

**Production default:** AT-only publish when `HYPERCERTS_AT_ENABLED=true`. Celo minter remains for optional dual-write / DCU bonus until IdentityLink and anchor specs mature.

---

## AT Protocol data model

Everything is a **claim** as a lexicon-typed record in a PDS or SDS repo.

### Core record: activity (the hypercert)

- **NSID:** `org.hypercerts.claim.activity`
- **Required:** `title`, `shortDescription`, `createdAt`
- **Important optional:** `workScope`, `startDate`, `endDate`, `contributors[]`, `locations[]` (refs to `app.certified.location`), `rights` (strong ref), `image`
- **Lexicon:** [activity.json](https://github.com/hypercerts-org/hypercerts-lexicon/blob/main/lexicons/org/hypercerts/claim/activity.json)

### Supporting records

| Lexicon | DeCleanup use |
|---------|---------------|
| `org.hypercerts.claim.measurement` | kg, m², bags, hours |
| `org.hypercerts.claim.evidence` | before/after photos, impact report |
| `org.hypercerts.claim.contribution` | contributor roles |
| `org.hypercerts.claim.evaluation` | verifier approval |
| `org.hypercerts.claim.rights` | photo-sharing presets (`rights-presets.ts`) |
| `app.certified.location` | cleanup GPS |
| `org.hypercerts.context.*` | cross-repo acknowledgements |

Records link via **AT-URIs** (`at://did:plc:…/org.hypercerts.claim.activity/…`).

### Certified layer

Shared primitives: profiles, locations, badges, optional `signatures[]` on records (`app.certified.signature.*`) for platform attestation.

### Org repos (SDS)

For **platform-issued** certs (like our verifier-approved flow), Hypercerts extends PDS with **Shared Data Server (SDS)** — multi-user org DIDs. See [ATProto community thread](https://discourse.atprotocol.community/t/hypercerts-recognizing-and-rewarding-impact-atproto-implementation/347).

---

## Mapping DeCleanup metadata → AT activity

| DeCleanup today (`metadata.ts`) | AT Protocol target |
|--------------------------------|-------------------|
| `name` / branding title | `activity.title` |
| `description` / `scopeOfWork` | `activity.shortDescription` |
| `hypercert.work_scope` | `activity.workScope` (`workScopeString.scope`) |
| `hypercert.work_timeframe` | `activity.startDate`, `activity.endDate` |
| `hypercert.impact_scope` (waste types) | measurement record(s) or scope text |
| `hypercert.contributors` (0x addresses) | `contributors[]` — needs **DID or IdentityLink** |
| `hypercert.rights` | `org.hypercerts.claim.rights` record + strong ref |
| `properties` (weight, area, bags, time) | `measurement` records |
| Logo/banner IPFS CIDs | PDS blob upload or URI ref |
| Cleanup GPS | `app.certified.location` + `activity.locations[]` |
| Per-cleanup impact IPFS JSON | `evidence` record(s) |
| `campaignName` (impact report) | `activity.title` or part of `workScope` |

Aggregation (`aggregation.ts`, impact indexer) can stay; add a **mapper** from `ImpactEntry[]` → validated AT record set.

---

## Integration options for DeCleanup

| Option | Pros | Cons |
|--------|------|------|
| **Per-user PDS** | Portable, user-owned certs | Requires ATProto OAuth; not wallet-only |
| **DeCleanup org SDS** | Matches admin-approve workflow | SDS hosting; ops complexity |
| **Hybrid** | Celo proof + AT cert | Two systems to sync |
| **Keep EVM only** | DCU bonus unchanged | Not interoperable with 2026 Hypercerts ecosystem |

**Hardest gaps:** wallet → DID (**IdentityLink**), org vs user repo ownership, keeping `claimHypercertReward` aligned with AT URI as canonical cert.

---

## Research plan

### Phase A — Spec (2–3 days)

1. [Introduction to Lexicons](https://docs.hypercerts.org/lexicons/introduction-to-lexicons)
2. [Why AT Protocol?](https://docs.hypercerts.org/core-concepts/why-at-protocol)
3. [hypercerts-lexicon](https://github.com/hypercerts-org/hypercerts-lexicon) — activity, measurement, evidence, rights, evaluation
4. [Adoption Strategy Memo 2026](https://gist.github.com/holkexyz/6fb79cdc7c3db8e9093e1ad93892db15)
5. [hypercerts-scaffold-atproto](https://github.com/hypercerts-org/hypercerts-scaffold-atproto)

### Phase B — Prototype (2–3 days)

1. Clone scaffold; OAuth → create one `activity` record
2. Attach `measurement` + `evidence` for a fake cleanup
3. Validate with `@hypercerts-org/lexicon` before write
4. Map one real DeCleanup verified submission end-to-end on paper

### Phase C — Hypercerts Foundation questions

1. Is Celo `HypercertMinterUUPS` still supported or sunset?
2. Dual-write vs migrate-only for existing EVM apps?
3. **IdentityLink** status for Celo wallets?
4. Org SDS for “DeCleanup Network” issued certs?
5. Verifier approval → `evaluation` lexicon pattern?
6. Celo-specific anchor spec?

Contact: [hypercerts.org/contact](https://hypercerts.org/contact)

---

## Migration phases

```
Today (Celo v0.1)
  Verified cleanups → IPFS ERC-1155 metadata → mintClaim → claimHypercertReward

Phase 1 — Dual publish (recommended first build)
  Same data → map to AT activity + measurements → write PDS/SDS
  Store AT URI in Supabase; keep Celo mint for DCU bonus

Phase 2 — AT canonical
  AT URI = source of truth; IdentityLink wallet ↔ DID
  Celo mint optional anchor only

Phase 3 — Drop EVM mint
  Only when Hypercerts + DCURewardManager policy supports AT-native counting
```

---

## Next steps to adapt AT Protocol

Ordered list for DeCleanup. **Do not change production mint yet** until step 6 is answered.

### Step 1 — Read the spec (1–2 days)

- [Introduction to Lexicons](https://docs.hypercerts.org/lexicons/introduction-to-lexicons)
- [Why AT Protocol?](https://docs.hypercerts.org/core-concepts/why-at-protocol)
- Lexicon files: `activity`, `measurement`, `evidence`, `rights`, `evaluation` in [hypercerts-lexicon](https://github.com/hypercerts-org/hypercerts-lexicon)
- [hypercerts-scaffold-atproto](https://github.com/hypercerts-org/hypercerts-scaffold-atproto) README and `lib/atproto-writes.ts`

**Do not use** `@hypercerts-org/sdk-core` (unmaintained). Target stack: `@hypercerts-org/lexicon` + `@atproto/api`.

### Step 2 — Run the scaffold locally (1–2 days)

1. Clone `hypercerts-scaffold-atproto` and complete OAuth login.
2. Create one `org.hypercerts.claim.activity` record manually.
3. Add linked `measurement` + `evidence` records for a fake cleanup.
4. Validate every record with `OrgHypercertsClaimActivity.validateRecord()` before write.

Goal: understand PDS writes, blob upload, and strong refs — not integrate into DeCleanup yet.

### Step 3 — Map one real DeCleanup cleanup (1 day, paper + JSON)

Take one verified submission from mainnet and document:

```
Submission #N (Celo)
  → impact IPFS JSON
  → before/after photos
  → verifier approval
  → activity record (title, workScope, dates)
  → measurement records (kg, m², bags, hours)
  → evidence records (photos + impact report)
  → rights record (from rights-presets.ts)
  → location record (GPS)
  → evaluation record (verifier approve)
```

Decide **repo owner**: user PDS vs **DeCleanup org SDS** (recommended for admin-approved certs).

### Step 4 — Build the mapper spike (2–3 days code)

Add `frontend/src/lib/blockchain/hypercerts/atproto-mapper.ts`:

- Input: existing `HypercertMetadataInput` + `ImpactEntry[]` from indexer
- Output: validated AT record payloads (activity + measurements + evidence + rights)
- Unit tests only — no API route, no production publish

Reuse: `aggregation.ts`, `metadata.ts`, `rights-presets.ts`, impact indexer normalization.

### Step 5 — Contact Hypercerts Foundation (parallel)

Email [hypercerts.org/contact](https://hypercerts.org/contact) with:

1. Is Celo `HypercertMinterUUPS` still supported or sunset?
2. Recommended dual-write path for existing EVM apps?
3. **IdentityLink** — link Celo wallet (Safe/EOA) to ATProto DID?
4. Org **SDS** for platform-issued certs after verifier approval?
5. Verifier approval → which `evaluation` lexicon pattern?
6. Celo on-chain anchor spec (if any)?

Answers gate Phase 1 vs Phase 2.

### Step 6 — Phase 1 dual-write (first production change)

When steps 3–5 are clear:

1. After hypercert request **APPROVED**, server publishes AT records (org SDS or user PDS).
2. Store `atUri` + `atCid` on `hypercert_requests` in Supabase (new columns).
3. **Keep** existing flow: user still `mintClaim` on Celo for DCU `claimHypercertReward`.
4. Show AT URI on `/hypercerts` as “portable certificate link.”

No contract changes in Phase 1.

### Step 7 — Phase 2 (later, after IdentityLink + anchor clarity)

- AT URI becomes canonical certificate in UI and public impact portfolio.
- Celo mint becomes optional anchor (or removed if DCURewardManager policy updated).
- Link user wallet ↔ DID via IdentityLink when available.

### What stays unchanged through Phase 1

| Keep | Why |
|------|-----|
| Celo `mintClaim` | `claimHypercertReward` DCU bonus depends on on-chain hypercert count |
| `@hypercerts-org/sdk` (EVM) | Still needed for Phase 1 Celo mint |
| Submission + verifier flow | Source of truth for verified cleanups |
| Impact report IPFS JSON | Feeds mapper; evidence records can reference same CIDs |
| Admin approve in Supabase | Triggers AT publish in Phase 1 |

---

## Recommendation

| Path | Action |
|------|--------|
| **AT lexicons for cert publish** | **Yes** — Phase 1 dual-write after mapper + Foundation answers |
| **EVM mint only forever** | **No** — ecosystem moving to AT; keep short term for DCU |
| **Custom ERC-1155 marketplace fork** | **No** — out of scope for DeCleanup rewards |

---

## References

| Resource | URL |
|----------|-----|
| Hypercerts docs | https://docs.hypercerts.org/ |
| Lexicons intro | https://docs.hypercerts.org/lexicons/introduction-to-lexicons |
| Why AT Protocol | https://docs.hypercerts.org/core-concepts/why-at-protocol |
| Lexicon repo | https://github.com/hypercerts-org/hypercerts-lexicon |
| ATProto scaffold | https://github.com/hypercerts-org/hypercerts-scaffold-atproto |
| Strategy memo 2026 | https://gist.github.com/holkexyz/6fb79cdc7c3db8e9093e1ad93892db15 |
| ATProto community thread | https://discourse.atprotocol.community/t/hypercerts-recognizing-and-rewarding-impact-atproto-implementation/347 |
| DeCleanup hypercerts code | `frontend/src/lib/blockchain/hypercerts/` |

Questions worth asking:

Is Celo HypercertMinterUUPS still supported or sunset?
Recommended path for existing EVM apps (dual-write vs migrate-only)?
IdentityLink status for Celo wallets?
Can DeCleanup Network use an org SDS for issued certs?
How should verifier evaluation map to evaluation lexicon?
Is there a Celo-specific anchor spec yet?
Contact: hypercerts.org/contact, strategy memo mentions Ma Earth / Foundation partners.
