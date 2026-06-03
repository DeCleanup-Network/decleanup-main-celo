import type { CleanupFeedRow } from '@/lib/supabase/cleanup-feed'
import { formatApproxCoords } from '@/lib/impact/location-label'
import { hashToProxyDisplayUrl } from '@/lib/impact/public-portfolio-data'

function fmtNum(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(digits)
}

export function buildCleanupSummary(
  row: Pick<
    CleanupFeedRow,
    | 'weight_kg'
    | 'location_label'
    | 'has_recyclables'
    | 'recyclables_amount_kg'
    | 'recyclables_amount_display'
    | 'area_sqm'
    | 'bags'
  >
): string {
  const parts: string[] = []

  if (row.weight_kg > 0) {
    parts.push(`Removed ${fmtNum(row.weight_kg)} kg of waste`)
  } else {
    parts.push('Verified cleanup')
  }

  if (row.location_label) {
    parts.push(`at ${row.location_label}`)
  }

  if (row.has_recyclables) {
    if (row.recyclables_amount_kg != null && row.recyclables_amount_kg > 0) {
      parts.push(`recycled ${fmtNum(row.recyclables_amount_kg)} kg`)
    } else if (row.recyclables_amount_display) {
      parts.push(`recycled ${row.recyclables_amount_display}`)
    } else {
      parts.push('includes recyclables')
    }
  }

  if (row.area_sqm > 0) {
    parts.push(`${fmtNum(row.area_sqm)} m² cleared`)
  }

  if (row.bags > 0) {
    parts.push(`${row.bags} bag${row.bags === 1 ? '' : 's'} collected`)
  }

  return parts.join(' · ')
}

export type PublicCleanupFeedItem = {
  submissionId: string
  chainId: number
  submitter: string
  submittedAt: string | null
  verifiedAt: string | null
  location: {
    /** Full display line: place + coords when available (no beach/park category). */
    label: string
    /** Reverse-geocoded place, e.g. "Tokyo, Japan". Null if unknown. */
    placeName: string | null
    /** Rounded coords for display, e.g. "35.7°, 139.7°". Null if no GPS. */
    coordinates: string | null
    latitude: number | null
    longitude: number | null
  }
  impact: {
    weightKg: number
    areaSqm: number
    bags: number
    durationMinutes: number
    wasteTypes: string[]
    contributorsCount: number
    hasImpactReport: boolean
  }
  recyclables: {
    hasRecyclables: boolean
    amountKg: number | null
    amountDisplay: string | null
    photoUrl: string | null
    receiptUrl: string | null
  }
  media: {
    beforePhotoUrl: string | null
    afterPhotoUrl: string | null
    /** True when at least one photo URL is present (user opted in + shareable license). */
    hasPublicPhotos: boolean
  }
  summary: string
  syncedAt: string
}

export function rowToPublicFeedItem(row: CleanupFeedRow): PublicCleanupFeedItem {
  const beforePhotoUrl = row.before_photo_cid
    ? hashToProxyDisplayUrl(row.before_photo_cid)
    : null
  const afterPhotoUrl = row.after_photo_cid ? hashToProxyDisplayUrl(row.after_photo_cid) : null
  const recyclablesPhotoUrl = row.recyclables_photo_cid
    ? hashToProxyDisplayUrl(row.recyclables_photo_cid)
    : null
  const recyclablesReceiptUrl = row.recyclables_receipt_cid
    ? hashToProxyDisplayUrl(row.recyclables_receipt_cid)
    : null

  return {
    submissionId: row.submission_id,
    chainId: row.chain_id,
    submitter: row.submitter,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    location: {
      label: row.location_label,
      placeName: row.location_place_name,
      coordinates:
        row.latitude != null && row.longitude != null
          ? formatApproxCoords(row.latitude, row.longitude)
          : null,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    impact: {
      weightKg: row.weight_kg,
      areaSqm: row.area_sqm,
      bags: row.bags,
      durationMinutes: row.duration_minutes,
      wasteTypes: row.waste_types,
      contributorsCount: row.contributors_count,
      hasImpactReport: row.has_impact_report,
    },
    recyclables: {
      hasRecyclables: row.has_recyclables,
      amountKg: row.recyclables_amount_kg,
      amountDisplay: row.recyclables_amount_display,
      photoUrl: recyclablesPhotoUrl,
      receiptUrl: recyclablesReceiptUrl,
    },
    media: {
      beforePhotoUrl,
      afterPhotoUrl,
      hasPublicPhotos: Boolean(beforePhotoUrl || afterPhotoUrl || recyclablesPhotoUrl),
    },
    summary: row.summary || buildCleanupSummary(row),
    syncedAt: row.synced_at,
  }
}
