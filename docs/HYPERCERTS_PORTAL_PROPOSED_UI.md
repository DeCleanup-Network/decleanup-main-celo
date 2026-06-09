# Hypercerts portal — proposed UI (Green Goods review)

**Last updated:** June 2026  
**Status:** Proposed only — not implemented  
**Reference app:** [Green Goods Admin](https://admin.greengoods.app) — DeCleanup Network Action garden (`gardenAddress=0xe1Da…6593`)  
**Screenshots (local):** `.cursor/projects/.../assets/Screenshot_2569-06-09_at_12.34.*.png`

**Related:** `docs/HYPERCERTS.md`, `docs/HYPERCERTS_ATPROTO_RESEARCH.md`, `frontend/src/app/hypercerts/page.tsx`, `frontend/src/lib/blockchain/hypercerts/`

---

## Executive summary

Green Goods Admin implements a **multi-step hypercert mint wizard** that is richer than DeCleanup’s current `/hypercerts` page. It is **not a replacement for the core Hypercerts v0.1 dimension spec** (work scope, impact scope, timeframes, contributors, rights) — DeCleanup already builds those in `metadata.ts`. Green Goods adds **garden-specific UX and ESG layers** on top:

| Layer | Green Goods | DeCleanup today |
|-------|-------------|-----------------|
| Core hypercert dimensions | Step 02 (explicit form fields) | Auto-derived from aggregated cleanups |
| Attestation picker | Step 01 (select approved work) | Implicit: all verified cleanups bundled |
| SDG tags | 17-goal multi-select | SDG mapping exists for portfolio, not hypercert mint |
| Capitals taxonomy | 8-capital multi-select | Not implemented |
| Unit distribution | Step 04 (equal / proportional / custom) | Not implemented (single claimant) |
| Preview before mint | Step 04 | Metadata preview partial; no full wizard |

**Recommendation:** Adopt Green Goods’ **wizard structure and ESG fields** for a future DeCleanup hypercerts portal, while keeping existing Celo mint + verifier workflow until AT Protocol migration (`HYPERCERTS_ATPROTO_RESEARCH.md`).

---

## Green Goods flow (observed)

### Navigation shell

- Top bar: garden name, notifications, settings, profile
- Bottom pill nav: **Hub** | **Garden** | **Community**
- URL pattern: `/hub/certify/create?gardenAddress=0x…&sort=newest`

### Step 01 — Attestations

**Label:** `01 Attestations` / “Select approved work”

- Banner when none selected: “Select at least one attestation to continue”
- Search: title, gardener, domain
- Domain filter dropdown
- Select all / Deselect all
- List of **approved attestations** as horizontal cards:
  - Title: `Cleanup Event – {ISO timestamp}`
  - Gardener: truncated address (`0xc1…2Bb`)
  - Status: `Approved on {date}`
  - **Select** button per row

**DeCleanup mapping:** Each row = one **verified cleanup submission** (optionally filtered to those with impact reports). Gardener = cleanup leader wallet or submission owner.

### Step 02 — Metadata

**Label:** `02 Metadata` / “Describe the impact”

| Field | Required | Notes |
|-------|----------|-------|
| Hypercert title | Yes | e.g. “Urban soil regeneration 2025” |
| Description | No | Long text |
| Work scope | Yes | Comma-separated list → `hypercert.work_scope` |
| Impact scope | Yes | Comma-separated list → `hypercert.impact_scope` |
| Work timeframe | Yes | Start + end date pickers |
| Impact timeframe | No | Defaults to work timeframe; end can be “ongoing” |

**Standards:** Matches [Hypercerts metadata dimensions](https://docs.hypercerts.org/) for scope and timeframe. DeCleanup already auto-fills these from `buildHypercertMetadata()` but does not expose them in a form.

### Step 02b — SDGs (same wizard, later screen)

- “Select all SDGs that apply”
- **17 UN SDGs** as pill toggles in a 3-column grid (numbered labels, not official icons in Green Goods)
- Maps to ESG disclosure; **not** part of classic ERC-1155 `hypercert` JSON today — store as `properties` or extension field

**DeCleanup:** Reuse `SDG_METADATA` / waste-type → SDG mapping from `frontend/src/lib/impact/sdg-mapping.ts`; suggest defaults from selected cleanups’ waste types.

### Step 02c — Capitals (same wizard)

- “Select the forms of capital impacted”
- Eight pills (2-column grid):
  - Living, Material, Intellectual, Spiritual, Social, Financial, Experiential, Cultural

**Note:** This aligns with **natural/social capital** framing (TNFD-adjacent), not the original Hypercerts v0.1 spec. Treat as **optional extension** for funders; store in metadata `properties` or `extensions.capitals[]`.

### Step 03 — Distribution (implied; screenshot shows step 04)

**Label:** `04 Preview & Mint` section includes **Distribution**

- “Configure how units are allocated across contributors”
- Modes: **Equal** | **Proportional (count)** | **Proportional (value)** | **Custom**
- Table: Recipient | Units | Percent
- Validation: “Add at least one recipient” / Total units: 0
- Preview: “Preview will appear once attestations are selected”

**DeCleanup mapping:** Recipients = cleanup contributors from impact report JSON + referral graph (future). Units = hypercert fraction or DCU bonus split — product decision.

### Step 04 — Preview & Mint

- Review assembled metadata + selected attestations
- **Cancel** | **Mint** (primary)
- Mint disabled until attestations + recipients valid

---

## Are they using “new standards”?

| Item | Standard? | Notes |
|------|-----------|-------|
| work_scope, impact_scope, timeframes | **Yes — Hypercerts v0.1** | Core dimension model |
| Attestations as selectable inputs | **Green Goods / garden pattern** | Good UX; maps to DeCleanup verified submissions |
| SDG 1–17 tags | **ESG extension** | Common for grant/CSR; not in base hypercert JSON |
| 8 Capitals | **ESG / TNFD-style extension** | Green Goods-specific taxonomy |
| Distribution split | **Fractional ownership UX** | Hypercerts support multi-contributor; we don’t expose it |
| AT Protocol lexicons | **Hypercerts v0.2+ direction** | Green Goods UI still looks EVM/garden-centric; see `HYPERCERTS_ATPROTO_RESEARCH.md` |

Green Goods is **ahead on disclosure UX**, not on a different onchain standard. Safe to **copy the wizard pattern** and extension fields without breaking existing `HypercertMetadata` builder.

---

## Proposed DeCleanup hypercerts portal UI

**Route (proposed):** `/hypercerts/create` or replace `/hypercerts` with tabbed **Hub** view.

**Brand:** DeCleanup dark-first (`#58b12f`, Space Grotesk, card borders — same as impact portfolio).

### Wizard steps

```
01 Select cleanups  →  02 Metadata  →  03 ESG tags  →  04 Distribution  →  05 Preview & submit
```

| Step | Title | Content |
|------|-------|---------|
| **01** | Verified work | List verified cleanups (+ impact report badge). Search by campaign name, date, location. Multi-select. Min 1. Show gardener address + approval timestamp from chain. |
| **02** | Metadata | Title*, description, work scope*, impact scope*, work dates*, impact dates (optional). Pre-fill from aggregation; allow edit. Optional image upload (logo/banner — already in current page). |
| **03** | ESG alignment | SDG multi-select (official colored icons, compact grid). Capitals multi-select (optional). Location: country / region / city from impact report GPS. |
| **04** | Distribution | Default: 100% to requester. Advanced: split across contributors (equal / by cleanup count / custom %). Only show if multiple contributors detected. |
| **05** | Preview | JSON preview of `HypercertMetadata` + IPFS CIDs. Actions: **Submit for verifier review** (current flow) or **Mint** if pre-approved. |

### Post-submit (unchanged logic)

1. Verifier approves (`PENDING` → `APPROVED`)
2. User mints on Celo (`mintHypercert` + `claimHypercertReward`)
3. Portfolio `data.hypercerts[]` populated from mint index (TODO in `public-portfolio-data.ts`)

### Hub page (non-wizard)

- Eligibility counts (existing)
- Request status list (existing)
- Link: **Create hypercert** → wizard
- Link: Impact portfolio disclosure

---

## Data model extensions (for implementation)

Extend `HypercertMetadataInput` / metadata JSON:

```typescript
// Proposed extensions (not in production types yet)
interface HypercertEsgExtension {
  sdgs: number[]           // 1-17
  capitals?: string[]      // living | material | ...
  locations?: {
    country?: string
    region?: string
    city?: string
    coordinates?: { lat: number; lng: number }
  }
}

interface HypercertDistribution {
  mode: 'equal' | 'proportional_count' | 'proportional_value' | 'custom'
  recipients: Array<{
    address: string
    units: number
    percent: number
  }>
}

interface HypercertWizardInput {
  selectedCleanupIds: string[]  // explicit vs auto-aggregate-all
  esg?: HypercertEsgExtension
  distribution?: HypercertDistribution
  // ...existing HypercertMetadataInput fields
}
```

Persist selected cleanup IDs on `HypercertRequest` so verifier sees exact bundle.

---

## Gap vs current `/hypercerts` page

| Feature | `frontend/src/app/hypercerts/page.tsx` | Proposed portal |
|---------|----------------------------------------|-----------------|
| Cleanup selection | All verified auto-bundled | Per-cleanup multi-select |
| Metadata form | Branding title/description only | Full scope + timeframe fields |
| SDG / capitals | None | Step 03 |
| Distribution | None | Step 04 |
| Wizard UX | Single-page + request button | 5-step flow |
| Verifier gate | Yes | Keep |
| Celo mint | Yes | Keep |

---

## Implementation order (suggested)

1. **Doc + static mock** — wizard routes with placeholder state (no mint)
2. **Step 01** — wire `getUserSubmissions` + `getCleanupDetails` list with select
3. **Step 02** — form bound to `buildHypercertMetadata` with overrides
4. **Step 03** — SDG picker (reuse portfolio SDG assets); capitals optional
5. **Step 04** — distribution table (single recipient default)
6. **Step 05** — preview + existing `submitHypercertRequest`
7. **Portfolio sync** — fill `hypercerts[]` after mint
8. **AT Protocol** — parallel track per `HYPERCERTS_ATPROTO_RESEARCH.md`

---

## Copy checklist from Green Goods (literal UX patterns)

- [ ] Step numbers (`01`, `02`, …) with short subtitle
- [ ] “Select at least one attestation to continue” guard banner
- [ ] Search + domain/category filter on attestation list
- [ ] Comma-separated scope fields with helper text
- [ ] Separate work vs impact timeframe (impact optional / ongoing)
- [ ] SDG grid (we upgrade to official UN icons)
- [ ] Capitals grid (optional for DeCleanup)
- [ ] Distribution mode pills + recipient table
- [ ] Preview gate before mint
- [ ] Cancel + primary Mint/Submit footer

---

## What not to copy

- Light gray Green Goods chrome (use DeCleanup dark theme)
- Em dashes in cleanup event titles (use ISO date or campaign name)
- Garden-only navigation (Hub/Garden/Community) unless we add coordinator role later
- Replacing verifier review with instant mint (keep DeCleanup fraud gate)

---

## Open questions

1. **Attestations source:** On-chain verified only, or also external garden attestations (EAS)?
2. **Distribution:** Cosmetic for metadata, or on-chain fractional hypercert units?
3. **Capitals:** Required for grants, or optional advanced field?
4. **AT migration:** Build wizard against v0.1 JSON first, or target AT `activity` record shape from day one?

---

## References

- Green Goods certify flow: `admin.greengoods.app/hub/certify/create`
- DeCleanup metadata builder: `frontend/src/lib/blockchain/hypercerts/metadata.ts`
- DeCleanup types: `frontend/src/lib/blockchain/hypercerts/types.ts`
- Hypercerts AT direction: `docs/HYPERCERTS_ATPROTO_RESEARCH.md`
