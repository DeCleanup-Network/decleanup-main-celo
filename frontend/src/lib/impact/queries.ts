import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { ImpactEntry } from './types'
import type { CleanupPhoto } from '@/lib/blockchain/hypercerts/atproto/types'

let serverClient: ReturnType<typeof createClient<Database>> | null = null

function getServerClient(): ReturnType<typeof createClient<Database>> {
  if (serverClient) return serverClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Supabase server env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  serverClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return serverClient
}

/**
 * Maps a hypercert_request_id to its ImpactEntries (approved submissions).
 *
 * Looks for submission IDs in metadata.cleanups[].cleanupId (HypercertMetadataInput)
 * with fallback to metadata.contributions[].submissionId.
 */
export async function getImpactEntriesByRequestId(requestId: string): Promise<ImpactEntry[]> {
  const supabase = getServerClient()

  const { data: request, error: reqError } = await supabase
    .from('hypercert_requests')
    .select('metadata')
    .eq('id', requestId)
    .single()

  if (reqError || !request) return []

  const metadata = request.metadata as any

  // Try cleanups array (HypercertMetadataInput shape)
  let submissionIds: string[] = (metadata?.cleanups ?? [])
    .map((c: any) => c.cleanupId || c.submissionId)
    .filter(Boolean)

  // Fallback: try contributions array
  if (submissionIds.length === 0) {
    submissionIds = (metadata?.contributions ?? [])
      .map((c: any) => c.submissionId)
      .filter(Boolean)
  }

  if (submissionIds.length === 0) return []

  const { data: feed, error: feedError } = await supabase
    .from('cleanup_feed')
    .select('*')
    .in('submission_id', submissionIds)

  if (feedError || !feed) return []

  return feed.map((row): ImpactEntry => ({
    submissionId: row.submission_id,
    submitter: row.submitter,
    timestamp: row.verified_at
      ? new Date(row.verified_at).getTime() / 1000
      : (row.submitted_at ? new Date(row.submitted_at).getTime() / 1000 : 0),
    latitude: row.latitude ?? 0,
    longitude: row.longitude ?? 0,
    locationType: row.location_type ?? 'Unknown',
    areaSqm: row.area_sqm ?? 0,
    weightKg: row.weight_kg ?? 0,
    bags: row.bags ?? 0,
    totalMinutes: row.duration_minutes ?? 0,
    wasteTypes: Array.isArray(row.waste_types) ? row.waste_types : [],
    contributors: [],
    ipfsHash: row.impact_ipfs_cid ?? '',
    resolvedAt: row.verified_at
      ? new Date(row.verified_at).getTime() / 1000
      : (row.submitted_at ? new Date(row.submitted_at).getTime() / 1000 : 0),
  }))
}

/**
 * Reads cleanup_feed and builds the photo array for ATProto attachments.
 */
export async function getCleanupPhotosBySubmissionId(submissionId: string): Promise<CleanupPhoto[]> {
  const supabase = getServerClient()

  const { data, error } = await supabase
    .from('cleanup_feed')
    .select('before_photo_cid, after_photo_cid, recyclables_photo_cid, impact_ipfs_cid')
    .eq('submission_id', submissionId)
    .single()

  if (error || !data) return []

  const photos: CleanupPhoto[] = []
  if (data.before_photo_cid) {
    photos.push({ cid: data.before_photo_cid, type: 'before', mimeType: 'image/jpeg' })
  }
  if (data.after_photo_cid) {
    photos.push({ cid: data.after_photo_cid, type: 'after', mimeType: 'image/jpeg' })
  }
  if (data.recyclables_photo_cid) {
    photos.push({ cid: data.recyclables_photo_cid, type: 'recyclables', mimeType: 'image/jpeg' })
  }
  if (data.impact_ipfs_cid) {
    photos.push({ cid: data.impact_ipfs_cid, type: 'evidence', mimeType: 'application/json' })
  }
  return photos
}
