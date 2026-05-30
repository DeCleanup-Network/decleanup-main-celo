import 'server-only'
import { getCleanupDetailsFresh } from '@/lib/blockchain/contracts'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { getImpactIndex } from '@/lib/impact/indexer'
import type { ImpactEntry } from '@/lib/impact/types'
import { formatLocationLabel } from '@/lib/impact/location-label'
import { buildCleanupSummary } from '@/lib/impact/cleanup-feed-format'
import {
  getCleanupFeedRow,
  upsertCleanupFeedRows,
  type CleanupFeedRow,
} from '@/lib/supabase/cleanup-feed'

function cidFromHash(hash: string): string {
  if (!hash) return ''
  return hash.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0].trim()
}

function bigintToIso(ts: bigint | undefined, fallbackMs?: number): string | null {
  const n = ts != null ? Number(ts) : fallbackMs
  if (!n || !Number.isFinite(n) || n <= 0) return null
  const ms = n > 1_000_000_000_000 ? n : n * 1000
  return new Date(ms).toISOString()
}

function coordsFromContract(rawLat: number, rawLng: number): { lat: number | null; lng: number | null } {
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return { lat: null, lng: null }
  if (rawLat === 0 && rawLng === 0) return { lat: null, lng: null }
  const lat = rawLat / 1_000_000
  const lng = rawLng / 1_000_000
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { lat: null, lng: null }
  return { lat, lng }
}

async function mapEntryToFeedRow(
  entry: ImpactEntry,
  existing: CleanupFeedRow | null
): Promise<Omit<CleanupFeedRow, 'created_at'>> {
  const details = await getCleanupDetailsFresh(BigInt(entry.submissionId))
  const { lat, lng } = coordsFromContract(entry.latitude, entry.longitude)
  const locationLabel = formatLocationLabel(entry.locationType, lat ?? 0, lng ?? 0)
  const nowIso = new Date().toISOString()

  const row: Omit<CleanupFeedRow, 'created_at'> = {
    submission_id: entry.submissionId,
    chain_id: REQUIRED_CHAIN_ID,
    submitter: entry.submitter.toLowerCase(),
    submitted_at: bigintToIso(details.timestamp, entry.timestamp * 1000),
    verified_at:
      bigintToIso(details.processedTimestamp) ??
      bigintToIso(details.timestamp, entry.timestamp * 1000),
    latitude: lat,
    longitude: lng,
    location_type: entry.locationType || '',
    location_label: locationLabel,
    area_sqm: entry.areaSqm,
    weight_kg: entry.weightKg,
    bags: entry.bags,
    duration_minutes: entry.totalMinutes,
    waste_types: entry.wasteTypes,
    contributors_count: entry.contributors.length,
    has_impact_report: Boolean(details.hasImpactForm && details.impactFormDataHash),
    has_recyclables: Boolean(details.hasRecyclables),
    recyclables_amount_kg: existing?.recyclables_amount_kg ?? null,
    recyclables_amount_display: existing?.recyclables_amount_display ?? null,
    recyclables_photo_cid: cidFromHash(details.recyclablesPhotoHash || ''),
    recyclables_receipt_cid: cidFromHash(details.recyclablesReceiptHash || ''),
    before_photo_cid: cidFromHash(details.beforePhotoHash || ''),
    after_photo_cid: cidFromHash(details.afterPhotoHash || ''),
    impact_ipfs_cid: cidFromHash(details.impactFormDataHash || entry.ipfsHash || ''),
    summary: '',
    synced_at: nowIso,
  }

  row.summary = buildCleanupSummary(row as CleanupFeedRow)
  return row
}

export async function syncCleanupFeedFromChain(): Promise<{
  synced: number
  chainId: number
}> {
  const entries = await getImpactIndex()
  const rows: Omit<CleanupFeedRow, 'created_at'>[] = []

  for (const entry of entries) {
    const existing = await getCleanupFeedRow(REQUIRED_CHAIN_ID, entry.submissionId)
    rows.push(await mapEntryToFeedRow(entry, existing))
  }

  const synced = await upsertCleanupFeedRows(rows)
  return { synced, chainId: REQUIRED_CHAIN_ID }
}

export async function ensureCleanupFeedSynced(options?: {
  maxAgeMinutes?: number
}): Promise<{ synced: boolean; count: number }> {
  const maxAgeMinutes = options?.maxAgeMinutes ?? 60
  const { listCleanupFeed, getLatestFeedSyncAt, isCleanupFeedConfigured } = await import(
    '@/lib/supabase/cleanup-feed'
  )

  if (!isCleanupFeedConfigured()) {
    return { synced: false, count: 0 }
  }

  const { total } = await listCleanupFeed({ chainId: REQUIRED_CHAIN_ID, limit: 1, offset: 0 })
  const latestSync = await getLatestFeedSyncAt(REQUIRED_CHAIN_ID)
  const stale =
    total === 0 ||
    !latestSync ||
    Date.now() - new Date(latestSync).getTime() > maxAgeMinutes * 60 * 1000

  if (!stale) {
    return { synced: false, count: total }
  }

  const result = await syncCleanupFeedFromChain()
  return { synced: true, count: result.synced }
}
