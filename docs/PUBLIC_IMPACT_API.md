# DeCleanup public impact API

Read-only JSON endpoints for the marketing / landing site. Data comes from **verified cleanups on Celo mainnet** (chain ID `42220`), indexed into Supabase and served by the dapp.

| | |
|---|---|
| **Production base URL** | `https://dapp.decleanup.net` |
| **Authentication** | None for read endpoints |
| **CORS** | `Access-Control-Allow-Origin: *` — callable from any origin |
| **Source code** | [decleanup-main-celo](https://github.com/DeCleanup-Network/decleanup-main-celo) → `frontend/src/app/api/impact/` |

---

## Endpoints overview

| Endpoint | Method | Purpose | CDN cache |
|----------|--------|---------|-----------|
| `/api/impact/global` | GET | Hero counters, charts, aggregates | ~1 hour |
| `/api/impact/cleanups` | GET | Paginated feed of verified cleanups | ~5 minutes |

Both endpoints trigger a background refresh when cached feed data is older than ~60 minutes. No action is required from the landing site.

**Location on the cleanups feed:** GPS comes from the on-chain submission. During indexing, the dapp reverse-geocodes coordinates to a place name (e.g. `"Tokyo, Japan"`) via [OpenStreetMap Nominatim](https://nominatim.org/). Public responses expose `placeName`, rounded `coordinates`, and full-precision `latitude` / `longitude`. Site categories such as beach or park are **not** included in `location` (use `impact.wasteTypes` for waste type).

---

## 1. Global stats

Aggregated metrics for hero sections, summary tiles, waste-type charts, and top-location lists.

### Request

```http
GET https://dapp.decleanup.net/api/impact/global
```

No query parameters. No request body.

### Response `200`

```json
{
  "project": "DeCleanup Network",
  "chainId": 42220,
  "metrics": {
    "total_cleanups_verified": 0,
    "total_weight_kg": 0,
    "total_area_sqm": 0,
    "total_bags": 0,
    "total_volunteer_time": "0 hours",
    "total_duration_minutes": 0,
    "cleanups_with_recyclables": 0,
    "total_recyclables_kg": 0,
    "waste_type_breakdown": [],
    "top_locations": []
  },
  "last_updated": "2026-05-30T13:05:52.262Z"
}
```

### Field reference

| Field | Type | Notes |
|-------|------|-------|
| `project` | string | Always `"DeCleanup Network"` |
| `chainId` | number | Always `42220` (Celo mainnet) |
| `metrics.total_cleanups_verified` | number | Count of verified cleanups in the feed |
| `metrics.total_weight_kg` | number | Sum of waste removed (kg), 1 decimal |
| `metrics.total_area_sqm` | number | Sum of area cleared (m²), 1 decimal |
| `metrics.total_bags` | number | Sum of bags collected |
| `metrics.total_volunteer_time` | string | Human-readable duration (e.g. `"42 hours"`, `"3 days"`) |
| `metrics.total_duration_minutes` | number | Raw total minutes (use for precise math) |
| `metrics.cleanups_with_recyclables` | number | Cleanups that included recyclables |
| `metrics.total_recyclables_kg` | number | Sum of recyclables (kg), 1 decimal |
| `metrics.waste_type_breakdown` | array | Sorted by count descending |
| `metrics.waste_type_breakdown[].type` | string | Waste category label (e.g. `"Plastic"`) |
| `metrics.waste_type_breakdown[].count` | number | Cleanups tagged with this type |
| `metrics.waste_type_breakdown[].percentage` | number | Share of total cleanups (0–100) |
| `metrics.top_locations` | array | Up to 10 locations, sorted by count |
| `metrics.top_locations[].location` | string | Location label |
| `metrics.top_locations[].cleanups` | number | Cleanup count at that location |
| `metrics.top_locations[].percentage` | number | Share of total cleanups (0–100) |
| `last_updated` | string | ISO 8601 timestamp of this response |

### UI mapping

| UI element | Field |
|------------|-------|
| “X cleanups verified” | `metrics.total_cleanups_verified` |
| “X kg removed” | `metrics.total_weight_kg` |
| “X m² cleared” | `metrics.total_area_sqm` |
| “X bags collected” | `metrics.total_bags` |
| Volunteer time headline | `metrics.total_volunteer_time` |
| Waste-type pie / bar chart | `metrics.waste_type_breakdown` |
| Top locations list | `metrics.top_locations` |

When the feed is empty, numeric fields are `0` and array fields are `[]`.

---

## 2. Recent cleanups feed

Paginated list of verified cleanups for cards, maps, and galleries. Sorted by **verified date, newest first** (fallback: submitted date).

### Request

```http
GET https://dapp.decleanup.net/api/impact/cleanups?limit=20&offset=0
```

| Parameter | Default | Min | Max | Description |
|-----------|---------|-----|-----|-------------|
| `limit` | `20` | `1` | `50` | Page size |
| `offset` | `0` | `0` | — | Rows to skip |

### Response `200` (empty feed)

```json
{
  "chainId": 42220,
  "total": 0,
  "limit": 20,
  "offset": 0,
  "items": [],
  "lastUpdated": null
}
```

### Response `200` (with data)

```json
{
  "chainId": 42220,
  "total": 142,
  "limit": 20,
  "offset": 0,
  "lastUpdated": "2026-05-30T13:05:15.496Z",
  "items": [
    {
      "submissionId": "123",
      "chainId": 42220,
      "submitter": "0xabc1234567890123456789012345678901234567",
      "submittedAt": "2026-03-15T10:00:00.000Z",
      "verifiedAt": "2026-03-16T14:30:00.000Z",
      "location": {
        "label": "Lisbon, Portugal · 38.7°, -9.4°",
        "placeName": "Lisbon, Portugal",
        "coordinates": "38.7°, -9.4°",
        "latitude": 38.697,
        "longitude": -9.421
      },
      "impact": {
        "weightKg": 12.5,
        "areaSqm": 200,
        "bags": 8,
        "durationMinutes": 120,
        "wasteTypes": ["Plastic", "Glass"],
        "contributorsCount": 4,
        "hasImpactReport": true
      },
      "recyclables": {
        "hasRecyclables": true,
        "amountKg": 3.2,
        "amountDisplay": "3.2 kg",
        "photoUrl": "https://dapp.decleanup.net/api/ipfs/fetch?url=...",
        "receiptUrl": null
      },
      "media": {
        "beforePhotoUrl": "https://dapp.decleanup.net/api/ipfs/fetch?url=...",
        "afterPhotoUrl": "https://dapp.decleanup.net/api/ipfs/fetch?url=..."
      },
      "summary": "Removed 12.5 kg of waste · at Lisbon, Portugal · 38.7°, -9.4° · recycled 3.2 kg · 200 m² cleared · 8 bags collected",
      "syncedAt": "2026-05-30T13:05:15.496Z"
    }
  ]
}
```

### Field reference (feed envelope)

| Field | Type | Notes |
|-------|------|-------|
| `chainId` | number | Always `42220` |
| `total` | number | Total verified cleanups (for pagination) |
| `limit` | number | Applied page size |
| `offset` | number | Applied offset |
| `items` | array | Cleanup objects (see below) |
| `lastUpdated` | string \| null | `syncedAt` of the newest item in this page, or `null` if empty |

### Field reference (each item)

| Field | Type | Notes |
|-------|------|-------|
| `submissionId` | string | On-chain submission ID (numeric string) |
| `chainId` | number | Always `42220` |
| `submitter` | string | Lowercase `0x` wallet address |
| `submittedAt` | string \| null | ISO 8601 |
| `verifiedAt` | string \| null | ISO 8601 |
| `location.label` | string | Full display line for tables: `"<placeName> · <coordinates>"` when GPS and geocoding succeed (e.g. `"Tokyo, Japan · 35.7°, 139.7°"`). Coords-only or `"Verified cleanup"` when data is missing. |
| `location.placeName` | string \| null | Reverse-geocoded locality (e.g. `"Tokyo, Japan"`). Filled during feed sync from OpenStreetMap Nominatim. `null` if GPS missing or lookup failed. |
| `location.coordinates` | string \| null | Rounded degree string for UI (1 decimal), e.g. `"35.7°, 139.7°"`. `null` if no GPS. |
| `location.latitude` | number \| null | Decimal degrees (WGS84) from on-chain submission GPS; `null` if missing or zero |
| `location.longitude` | number \| null | Decimal degrees (WGS84); `null` if missing or zero |
| `impact.weightKg` | number | Waste removed |
| `impact.areaSqm` | number | Area cleared |
| `impact.bags` | number | Bags collected |
| `impact.durationMinutes` | number | Volunteer time for this cleanup |
| `impact.wasteTypes` | string[] | Waste categories |
| `impact.contributorsCount` | number | Number of contributors |
| `impact.hasImpactReport` | boolean | Whether an impact form was submitted |
| `recyclables.hasRecyclables` | boolean | Whether recyclables were attached |
| `recyclables.amountKg` | number \| null | Recycled weight when known |
| `recyclables.amountDisplay` | string \| null | Display string (e.g. `"3.2 kg"`) |
| `recyclables.photoUrl` | string \| null | Recyclables photo |
| `recyclables.receiptUrl` | string \| null | Receipt photo, if any |
| `media.beforePhotoUrl` | string \| null | Before photo (only if submitter opted in) |
| `media.afterPhotoUrl` | string \| null | After photo (only if submitter opted in) |
| `media.hasPublicPhotos` | boolean | `true` when any photo URL is present |
| `summary` | string | Pre-built card copy — use as subtitle or teaser |
| `syncedAt` | string | ISO 8601 — when this row was last indexed |

### Display notes

- **`summary`** — Ready-made sentence for card subtitles; no need to assemble copy client-side.
- **`submitter`** — Public wallet address. Truncate for display (e.g. `0xabc1…4567`). Not personal data unless you choose to treat it as such.
- **Photos** — URLs point at the dapp IPFS proxy (`/api/ipfs/fetch?url=…`). On production they are usually absolute (`https://dapp.decleanup.net/...`). If you receive a path starting with `/`, prefix with the base URL.
- **Map pins** — Use `location.latitude` / `location.longitude` when both are non-null; skip items with missing coordinates.
- **Pagination** — Increment `offset` by `limit` until `offset >= total`.

### Recent Verifications table (decleanup.net)

Map API fields to your three columns as follows.

| UI column | API field | Example |
|-----------|-----------|---------|
| **Location** | `location.label` (or `placeName` + `coordinates` separately) | `Tokyo, Japan · 35.7°, 139.7°` |
| **Type** | First entry of `impact.wasteTypes`, or join with `", "` | `Plastic`, `Glass` |
| **Date** | `verifiedAt` (fallback `submittedAt`), format client-side | `2026-06-02` |

```javascript
function formatVerificationRow(item) {
  const location =
    item.location.label ||
    [item.location.placeName, item.location.coordinates].filter(Boolean).join(' · ') ||
    'Verified cleanup';

  const type =
    item.impact.wasteTypes?.length > 0
      ? item.impact.wasteTypes.join(', ')
      : '—';

  const dateSource = item.verifiedAt || item.submittedAt;
  const date = dateSource
    ? new Date(dateSource).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  return { location, type, date };
}
```

**Removed field:** `location.type` (beach/park/site category) is **not** returned on the public feed. Do not use it on the landing site.

### Photos (optional for landing UI)

Numbers and location always appear. **Photos are optional** — use them only if you want a gallery or card thumbnails.

| Rule | Detail |
|------|--------|
| When URLs are present | Submitter picked a **Hypercerts rights preset** that includes Public Display **and** checked the box for that photo |
| When URLs are `null` | “All Rights Reserved”, no impact report, or submitter did **not** allow that photo — **do not fetch elsewhere** |
| Quick check | `item.media.hasPublicPhotos === true` before rendering an `<img>` |
| Numbers-only UI | Ignore `media` and `recyclables.photoUrl` entirely; use `summary`, `impact`, and `location` |

```javascript
// Location column
const { placeName, coordinates, label } = item.location;

// Numbers-only card (no images)
const { summary, impact } = item;

// With optional thumbnail
const thumb = item.media.afterPhotoUrl ?? item.media.beforePhotoUrl;
if (item.media.hasPublicPhotos && thumb) {
  // render <img src={thumb} alt="" />
}
```

Photo URLs use the dapp IPFS proxy. Prefix relative paths with `https://dapp.decleanup.net`.

---

## 4. Integration example

```javascript
const BASE = 'https://dapp.decleanup.net';

async function loadImpactData() {
  const [globalRes, feedRes] = await Promise.all([
    fetch(`${BASE}/api/impact/global`),
    fetch(`${BASE}/api/impact/cleanups?limit=12&offset=0`),
  ]);

  if (!globalRes.ok || !feedRes.ok) {
    throw new Error('Impact API unavailable');
  }

  const global = await globalRes.json();
  const feed = await feedRes.json();

  return {
    stats: global.metrics,
    cleanups: feed.items,
    totalCleanups: feed.total,
  };
}
```

TypeScript types matching the API are in `frontend/src/lib/impact/cleanup-feed-format.ts` (`PublicCleanupFeedItem`).

---

## 5. Error handling

| HTTP status | Body shape | Recommended client behavior |
|-------------|------------|----------------------------|
| `200` | Success payload | Render data; empty arrays / zeros are valid |
| `503` | `{ "error": "..." }` | Backend not configured — show “data unavailable” fallback |
| `500` | `{ "error": "..." }` | Server error — retry with backoff or show fallback |

`OPTIONS` is supported on both endpoints (returns `204`) for CORS preflight.

---

## 6. Caching

Responses include CDN-friendly headers:

| Endpoint | `Cache-Control` |
|----------|-----------------|
| `/api/impact/global` | `public, s-maxage=3600, stale-while-revalidate=86400` |
| `/api/impact/cleanups` | `public, s-maxage=300, stale-while-revalidate=3600` |

Expect numbers to lag new on-chain verifications by up to the cache window (plus indexing time). For a marketing site this is usually fine.

---

## 7. Current data status

As of deployment, the feed may show **zero cleanups** until new submissions are verified on mainnet and indexed. A `200` response with empty `items` and zero metrics is normal — not an error.

Data appears automatically after:

1. A cleanup is submitted and verified on Celo mainnet (with GPS stored on chain when the user allows location).
2. The dapp indexes it into the cleanup feed (happens on the next API read if data is stale, or when ops run sync).

No setup or API keys are required on the landing site side.

**Place names:** After a backend deploy that adds `location_place_name`, run Supabase migration `frontend/supabase/migrations/20260603_cleanup_feed_place_name.sql`, then trigger `POST /api/impact/sync` (internal) so existing rows get geocoded labels. Until then, `placeName` may be `null` and `label` may show coordinates only.

---

## 8. Related links

| Resource | URL |
|----------|-----|
| Dapp (submit / connect wallet) | https://dapp.decleanup.net |
| API source (GitHub) | https://github.com/DeCleanup-Network/decleanup-main-celo |
| Global route | `frontend/src/app/api/impact/global/route.ts` |
| Cleanups route | `frontend/src/app/api/impact/cleanups/route.ts` |
| Response types | `frontend/src/lib/impact/cleanup-feed-format.ts` |

---

## 9. Out of scope for landing integration

Do **not** use these from the public landing site:

| Endpoint | Reason |
|----------|--------|
| `POST /api/impact/sync` | Internal ops only — requires `x-impact-sync-secret` (`IMPACT_SYNC_SECRET` on Vercel). Rebuilds the feed from chain + reverse geocoding (~1 Nominatim request per second per new coordinate). Landing site must not call this. |
| `POST /api/impact/cleanup-meta` | Dapp-only — stores recyclables amount after submit |
| `/api/impact/profile`, `/api/impact/export`, etc. | Authenticated or user-specific flows |

If you need additional public fields or endpoints, open an issue on the repo or contact the DeCleanup team.
