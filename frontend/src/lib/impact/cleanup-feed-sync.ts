import 'server-only'
import { getCleanupDetailsFresh, getCleanupDetailsAt } from '@/lib/blockchain/contracts'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import {
  buildImpactIndexAt,
  getImpactIndex,
  isLegacyFeedSubmissionId,
  legacyFeedOnChainSubmissionId,
  legacyFeedSubmissionId,
} from '@/lib/impact/indexer'
import type { ImpactEntry } from '@/lib/impact/types'
import { isAddress, type Address } from 'viem'
import { parseCoordsFromContractRaw } from '@/lib/impact/coords-from-contract'
import { formatLocationLabel } from '@/lib/impact/location-label'
import { buildCleanupSummary } from '@/lib/impact/cleanup-feed-format'
import {
  applyPublicFeedPhotoCids,
  parseImpactReportPhotoPermissions,
} from '@/lib/impact/feed-photo-permissions'
import {
  getCleanupFeedRow,
  upsertCleanupFeedRows,
  type CleanupFeedRow,
} from '@/lib/supabase/cleanup-feed'
import { fetchIpfsByCid } from '@/lib/utils/ipfs-gateway-proxy'

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

async function fetchImpactReportPermissions(impactCid: string) {
  if (!impactCid) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    const response = await fetchIpfsByCid(impactCid, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return null
    const text = await response.text()
    const trimmed = text.trim()
    if (!trimmed || trimmed.startsWith('<')) return null
    return parseImpactReportPhotoPermissions(JSON.parse(trimmed))
  } catch {
    return null
  }
}

async function mapEntryToFeedRow(
  entry: ImpactEntry,
  existing: CleanupFeedRow | null,
  submissionAddress?: Address
): Promise<Omit<CleanupFeedRow, 'created_at'>> {
  const onChainId = legacyFeedOnChainSubmissionId(entry.submissionId) ?? BigInt(entry.submissionId)
  const readAt = submissionAddress
  const details = readAt
    ? await getCleanupDetailsAt(readAt, onChainId)
    : await getCleanupDetailsFresh(onChainId)
  // Use on-chain microdegrees from contract — entry.latitude/longitude are already degrees from indexer.
  const { lat, lng } = parseCoordsFromContractRaw(details.latitude, details.longitude)
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

  const permissions = row.impact_ipfs_cid
    ? await fetchImpactReportPermissions(row.impact_ipfs_cid)
    : null
  const publicPhotos = applyPublicFeedPhotoCids({
    beforePhotoCid: row.before_photo_cid,
    afterPhotoCid: row.after_photo_cid,
    recyclablesPhotoCid: row.recyclables_photo_cid,
    recyclablesReceiptCid: row.recyclables_receipt_cid,
    permissions,
  })
  row.before_photo_cid = publicPhotos.before_photo_cid
  row.after_photo_cid = publicPhotos.after_photo_cid
  row.recyclables_photo_cid = publicPhotos.recyclables_photo_cid
  row.recyclables_receipt_cid = publicPhotos.recyclables_receipt_cid

  row.summary = buildCleanupSummary(row as CleanupFeedRow)
  return row
}

function legacySubmissionAddress(): Address | undefined {
  const raw = process.env.IMPACT_FEED_LEGACY_SUBMISSION_CONTRACT?.trim()
  if (!raw || !isAddress(raw)) return undefined
  return raw as Address
}

async function collectImpactEntriesForFeed(): Promise<{
  entries: ImpactEntry[]
  legacyAddress?: Address
}> {
  const primary = await getImpactIndex()
  const legacyAddress = legacySubmissionAddress()
  if (!legacyAddress) {
    return { entries: primary }
  }

  const legacy = await buildImpactIndexAt(legacyAddress)
  const legacyEntries = legacy.map((entry) => ({
    ...entry,
    submissionId: legacyFeedSubmissionId(entry.submissionId),
  }))

  console.log(
    `📦 Feed index: ${primary.length} current + ${legacyEntries.length} legacy (${legacyAddress})`
  )
  return { entries: [...legacyEntries, ...primary], legacyAddress }
}

export async function syncCleanupFeedFromChain(): Promise<{
  synced: number
  chainId: number
  primaryCount: number
  legacyCount: number
}> {
  const { entries, legacyAddress } = await collectImpactEntriesForFeed()
  const rows: Omit<CleanupFeedRow, 'created_at'>[] = []

  for (const entry of entries) {
    const existing = await getCleanupFeedRow(REQUIRED_CHAIN_ID, entry.submissionId)
    const legacyReadAt =
      legacyAddress && isLegacyFeedSubmissionId(entry.submissionId) ? legacyAddress : undefined
    rows.push(await mapEntryToFeedRow(entry, existing, legacyReadAt))
  }

  const synced = await upsertCleanupFeedRows(rows)
  const legacyCount = entries.filter((e) => isLegacyFeedSubmissionId(e.submissionId)).length
  return {
    synced,
    chainId: REQUIRED_CHAIN_ID,
    primaryCount: entries.length - legacyCount,
    legacyCount,
  }
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
