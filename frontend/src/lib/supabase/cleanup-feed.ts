import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getExcludedSubmissionIds, isExcludedSubmissionId } from '@/lib/submission/excluded-ids'

export type CleanupFeedRow = {
  submission_id: string
  chain_id: number
  submitter: string
  /** Public identity for portfolio links; null for external wallets without mapping. */
  eoa_address: string | null
  submitted_at: string | null
  verified_at: string | null
  latitude: number | null
  longitude: number | null
  location_type: string
  location_place_name: string | null
  location_label: string
  area_sqm: number
  weight_kg: number
  bags: number
  duration_minutes: number
  waste_types: string[]
  contributors_count: number
  has_impact_report: boolean
  has_recyclables: boolean
  recyclables_amount_kg: number | null
  recyclables_amount_display: string | null
  recyclables_photo_cid: string
  recyclables_receipt_cid: string
  before_photo_cid: string
  after_photo_cid: string
  impact_ipfs_cid: string
  optional_video_cid: string
  summary: string
  synced_at: string
  created_at: string
}

type DbRow = Database['public']['Tables']['cleanup_feed']['Row']
type DbInsert = Database['public']['Tables']['cleanup_feed']['Insert']

let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

export function isCleanupFeedConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()
  return Boolean(url && key)
}

function getSupabase() {
  if (supabaseServerClient) return supabaseServerClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server credentials for cleanup feed. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  supabaseServerClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseServerClient
}

function parseWasteTypes(raw: DbRow['waste_types']): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is string => typeof v === 'string')
}

function rowFromDb(data: DbRow): CleanupFeedRow {
  return {
    submission_id: data.submission_id,
    chain_id: data.chain_id,
    submitter: data.submitter,
    eoa_address: (data as DbRow & { eoa_address?: string | null }).eoa_address ?? null,
    submitted_at: data.submitted_at,
    verified_at: data.verified_at,
    latitude: data.latitude,
    longitude: data.longitude,
    location_type: data.location_type,
    location_place_name: data.location_place_name ?? null,
    location_label: data.location_label,
    area_sqm: data.area_sqm ?? 0,
    weight_kg: data.weight_kg ?? 0,
    bags: data.bags ?? 0,
    duration_minutes: data.duration_minutes ?? 0,
    waste_types: parseWasteTypes(data.waste_types),
    contributors_count: data.contributors_count ?? 0,
    has_impact_report: data.has_impact_report ?? false,
    has_recyclables: data.has_recyclables ?? false,
    recyclables_amount_kg: data.recyclables_amount_kg,
    recyclables_amount_display: data.recyclables_amount_display,
    recyclables_photo_cid: data.recyclables_photo_cid ?? '',
    recyclables_receipt_cid: data.recyclables_receipt_cid ?? '',
    before_photo_cid: data.before_photo_cid ?? '',
    after_photo_cid: data.after_photo_cid ?? '',
    impact_ipfs_cid: data.impact_ipfs_cid ?? '',
    optional_video_cid:
      (data as DbRow & { optional_video_cid?: string | null }).optional_video_cid ?? '',
    summary: data.summary ?? '',
    synced_at: data.synced_at,
    created_at: data.created_at,
  }
}

function rowToInsert(row: Omit<CleanupFeedRow, 'created_at'>): DbInsert {
  return {
    submission_id: row.submission_id,
    chain_id: row.chain_id,
    submitter: row.submitter.toLowerCase(),
    eoa_address: row.eoa_address?.toLowerCase() ?? null,
    submitted_at: row.submitted_at,
    verified_at: row.verified_at,
    latitude: row.latitude,
    longitude: row.longitude,
    location_type: row.location_type,
    location_place_name: row.location_place_name,
    location_label: row.location_label,
    area_sqm: row.area_sqm,
    weight_kg: row.weight_kg,
    bags: row.bags,
    duration_minutes: row.duration_minutes,
    waste_types: row.waste_types,
    contributors_count: row.contributors_count,
    has_impact_report: row.has_impact_report,
    has_recyclables: row.has_recyclables,
    recyclables_amount_kg: row.recyclables_amount_kg,
    recyclables_amount_display: row.recyclables_amount_display,
    recyclables_photo_cid: row.recyclables_photo_cid,
    recyclables_receipt_cid: row.recyclables_receipt_cid,
    before_photo_cid: row.before_photo_cid,
    after_photo_cid: row.after_photo_cid,
    impact_ipfs_cid: row.impact_ipfs_cid,
    optional_video_cid: row.optional_video_cid,
    summary: row.summary,
    synced_at: row.synced_at,
  }
}

export async function getCleanupFeedRow(
  chainId: number,
  submissionId: string
): Promise<CleanupFeedRow | null> {
  const { data, error } = await getSupabase()
    .from('cleanup_feed')
    .select('*')
    .eq('chain_id', chainId)
    .eq('submission_id', submissionId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch cleanup feed row: ${error.message}`)
  return data ? rowFromDb(data as DbRow) : null
}

export async function listCleanupFeed(params: {
  chainId: number
  limit: number
  offset: number
}): Promise<{ items: CleanupFeedRow[]; total: number }> {
  const { chainId, limit, offset } = params
  const excluded = getExcludedSubmissionIds()

  let countQuery = getSupabase()
    .from('cleanup_feed')
    .select('*', { count: 'exact', head: true })
    .eq('chain_id', chainId)
  for (const id of excluded) {
    countQuery = countQuery.neq('submission_id', id)
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(`Failed to count cleanup feed: ${countError.message}`)

  let listQuery = getSupabase()
    .from('cleanup_feed')
    .select('*')
    .eq('chain_id', chainId)
  for (const id of excluded) {
    listQuery = listQuery.neq('submission_id', id)
  }

  const { data, error } = await listQuery
    .order('verified_at', { ascending: false, nullsFirst: false })
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`Failed to list cleanup feed: ${error.message}`)

  return {
    items: (data as DbRow[]).map(rowFromDb),
    total: count ?? 0,
  }
}

export async function upsertCleanupFeedRows(
  rows: Omit<CleanupFeedRow, 'created_at'>[]
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map(rowToInsert)
  const { error } = await getSupabase()
    .from('cleanup_feed')
    .upsert(payload, { onConflict: 'chain_id,submission_id' })

  if (error) throw new Error(`Failed to upsert cleanup feed: ${error.message}`)
  return rows.length
}

export async function deleteCleanupFeedRows(
  chainId: number,
  submissionIds: string[]
): Promise<number> {
  if (submissionIds.length === 0) return 0

  const { error, count } = await getSupabase()
    .from('cleanup_feed')
    .delete({ count: 'exact' })
    .eq('chain_id', chainId)
    .in('submission_id', submissionIds)

  if (error) throw new Error(`Failed to delete cleanup feed rows: ${error.message}`)
  return count ?? 0
}

export async function updateRecyclablesMeta(params: {
  chainId: number
  submissionId: string
  amountKg: number | null
  amountDisplay: string
}): Promise<void> {
  const { chainId, submissionId, amountKg, amountDisplay } = params
  const { error } = await getSupabase()
    .from('cleanup_feed')
    .update({
      recyclables_amount_kg: amountKg,
      recyclables_amount_display: amountDisplay,
      synced_at: new Date().toISOString(),
    })
    .eq('chain_id', chainId)
    .eq('submission_id', submissionId)

  if (error) throw new Error(`Failed to update recyclables meta: ${error.message}`)
}

export async function getCleanupFeedGlobalStats(chainId: number): Promise<{
  totalCleanups: number
  totalWeightKg: number
  totalAreaSqm: number
  totalBags: number
  totalDurationMinutes: number
  cleanupsWithRecyclables: number
  totalRecyclablesKg: number
  wasteTypeCounts: Record<string, number>
  topLocations: Array<{ location: string; cleanups: number }>
}> {
  const { data, error } = await getSupabase()
    .from('cleanup_feed')
    .select(
      'submission_id, weight_kg, area_sqm, bags, duration_minutes, has_recyclables, recyclables_amount_kg, waste_types, location_type, location_label'
    )
    .eq('chain_id', chainId)

  if (error) throw new Error(`Failed to aggregate cleanup feed: ${error.message}`)

  const rows = (data ?? []) as Pick<
    DbRow,
    | 'submission_id'
    | 'weight_kg'
    | 'area_sqm'
    | 'bags'
    | 'duration_minutes'
    | 'has_recyclables'
    | 'recyclables_amount_kg'
    | 'waste_types'
    | 'location_type'
    | 'location_label'
  >[]

  const wasteTypeCounts: Record<string, number> = {}
  const locationCounts = new Map<string, number>()
  let totalWeightKg = 0
  let totalAreaSqm = 0
  let totalBags = 0
  let totalDurationMinutes = 0
  let cleanupsWithRecyclables = 0
  let totalRecyclablesKg = 0

  let totalCleanups = 0

  for (const row of rows) {
    if (isExcludedSubmissionId(row.submission_id ?? '')) continue
    totalCleanups += 1
    totalWeightKg += row.weight_kg ?? 0
    totalAreaSqm += row.area_sqm ?? 0
    totalBags += row.bags ?? 0
    totalDurationMinutes += row.duration_minutes ?? 0
    if (row.has_recyclables) {
      cleanupsWithRecyclables += 1
      totalRecyclablesKg += row.recyclables_amount_kg ?? 0
    }
    for (const wt of parseWasteTypes(row.waste_types)) {
      wasteTypeCounts[wt] = (wasteTypeCounts[wt] ?? 0) + 1
    }
    const locKey = row.location_type?.trim() || row.location_label?.trim() || 'Unknown'
    locationCounts.set(locKey, (locationCounts.get(locKey) ?? 0) + 1)
  }

  const topLocations = Array.from(locationCounts.entries())
    .map(([location, cleanups]) => ({ location, cleanups }))
    .sort((a, b) => b.cleanups - a.cleanups)
    .slice(0, 10)

  return {
    totalCleanups,
    totalWeightKg,
    totalAreaSqm,
    totalBags,
    totalDurationMinutes,
    cleanupsWithRecyclables,
    totalRecyclablesKg,
    wasteTypeCounts,
    topLocations,
  }
}

export async function getLatestFeedSyncAt(chainId: number): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('cleanup_feed')
    .select('synced_at')
    .eq('chain_id', chainId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read feed sync time: ${error.message}`)
  return data?.synced_at ?? null
}
