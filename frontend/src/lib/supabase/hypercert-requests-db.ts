import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { HypercertMetadata, HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import type { Database, Json } from './database.types'
import { portfolioLookupAddresses } from '@/lib/wallet/portfolio-lookup-addresses'

type Row = Database['public']['Tables']['hypercert_requests']['Row']

let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

function getSupabase(): ReturnType<typeof createClient<Database>> {
  if (supabaseServerClient) return supabaseServerClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server credentials for hypercert requests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) on the server.'
    )
  }

  supabaseServerClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseServerClient
}

function rowToRequest(row: Row): HypercertRequest {
  return {
    id: row.id,
    requester: row.requester,
    metadata: row.metadata as unknown as HypercertMetadata,
    metadataCid: row.metadata_cid ?? undefined,
    hypercertId: row.hypercert_id ?? undefined,
    txHash: row.tx_hash ?? undefined,
    status: row.status as HypercertRequest['status'],
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at != null ? Number(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    atUri: row.at_uri ?? undefined,
    atCid: row.at_cid ?? undefined,
    atPublishedAt: row.at_published_at ? new Date(row.at_published_at).getTime() / 1000 : undefined,
    atPublishError: row.at_publish_error ?? undefined,
  }
}

export async function hasOpenHypercertWorkflowForUser(requester: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('hypercert_requests')
    .select('id,status,at_uri')
    .eq('requester', requester.toLowerCase())

  if (error) throw new Error(`Failed to check open hypercert workflow: ${error.message}`)
  const rows = (data ?? []) as Pick<Row, 'id' | 'status' | 'at_uri'>[]
  return rows.some(
    (r) =>
      r.status === 'PENDING' ||
      (r.status === 'APPROVED' && (r.at_uri == null || r.at_uri === ''))
  )
}

export async function countPublishedHypercertsForUser(requester: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('hypercert_requests')
    .select('id,at_uri')
    .eq('requester', requester.toLowerCase())

  if (error) throw new Error(`Failed to count published hypercerts: ${error.message}`)
  const rows = (data ?? []) as Pick<Row, 'id' | 'at_uri'>[]
  return rows.filter((r) => r.at_uri != null && r.at_uri !== '').length
}

export async function insertHypercertRequest(params: {
  id: string
  requester: string
  metadata: HypercertMetadata
  submittedAt: number
}): Promise<HypercertRequest> {
  const insert = {
    id: params.id,
    requester: params.requester.toLowerCase(),
    metadata: params.metadata as unknown as Json,
    status: 'PENDING',
    submitted_at: params.submittedAt,
  }

  const { data, error } = await getSupabase()
    .from('hypercert_requests')
    // Manual Database typings occasionally resolve Insert as `never` with @supabase/supabase-js
    .insert([insert] as never)
    .select()
    .single()

  if (error) throw new Error(`Failed to create hypercert request: ${error.message}`)
  return rowToRequest(data as Row)
}

export async function getHypercertRequestById(id: string): Promise<HypercertRequest | null> {
  const { data, error } = await getSupabase()
    .from('hypercert_requests')
    .select()
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw new Error(`Failed to load hypercert request: ${error.message}`)
  return rowToRequest(data as Row)
}

export async function listHypercertRequests(filters: {
  requester?: string
  status?: HypercertRequest['status']
}): Promise<HypercertRequest[]> {
  let q = getSupabase().from('hypercert_requests').select().order('submitted_at', { ascending: false })

  if (filters.requester) {
    q = q.eq('requester', filters.requester.toLowerCase())
  }
  if (filters.status) {
    q = q.eq('status', filters.status)
  }

  const { data, error } = await q
  if (error) throw new Error(`Failed to list hypercert requests: ${error.message}`)
  return (data as Row[]).map(rowToRequest)
}

/** List requests for EOA + optional legacy smart-account requester (deduped). */
export async function listHypercertRequestsForPortfolio(
  eoaAddress: string,
  legacySmartAccount?: string | null,
  filters?: { status?: HypercertRequest['status'] }
): Promise<HypercertRequest[]> {
  const addresses = portfolioLookupAddresses(eoaAddress, legacySmartAccount)
  if (addresses.length === 1) {
    return listHypercertRequests({ requester: addresses[0], status: filters?.status })
  }

  let q = getSupabase()
    .from('hypercert_requests')
    .select()
    .in('requester', addresses)
    .order('submitted_at', { ascending: false })

  if (filters?.status) {
    q = q.eq('status', filters.status)
  }

  const { data, error } = await q
  if (error) throw new Error(`Failed to list hypercert requests: ${error.message}`)

  const seen = new Set<string>()
  const out: HypercertRequest[] = []
  for (const row of (data as Row[]) ?? []) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(rowToRequest(row))
  }
  return out
}

export async function updateHypercertRequestStatus(params: {
  id: string
  status: HypercertRequest['status']
  reviewedBy?: string
  reviewedAt?: number
  rejectionReason?: string
}): Promise<HypercertRequest> {
  const patch: Database['public']['Tables']['hypercert_requests']['Update'] = {
    status: params.status,
    reviewed_by: params.reviewedBy ?? null,
    reviewed_at: params.reviewedAt ?? null,
    rejection_reason: params.rejectionReason ?? null,
  }

  const { data, error } = await getSupabase()
    .from('hypercert_requests')
    .update(patch as never)
    .eq('id', params.id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update hypercert request: ${error.message}`)
  return rowToRequest(data as Row)
}

/**
 * Persists the ATProto publication result on the request row.
 * Reuses the private getSupabase() singleton already in this file.
 */
export async function recordAtProtoEvidence(
  requestId: string,
  result: { atUri: string; atCid: string },
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('hypercert_requests')
    .update({
      at_uri: result.atUri,
      at_cid: result.atCid,
      at_published_at: new Date().toISOString(),
      at_publish_error: null,
      at_version: 'lexicon-v1',
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(`Failed to save AT URI: ${error.message}`)
  }
}

/**
 * Persists ATProto publication error for later diagnosis.
 */
export async function recordAtProtoError(
  requestId: string,
  errorMessage: string,
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('hypercert_requests')
    .update({ at_publish_error: errorMessage })
    .eq('id', requestId)

  if (error) {
    console.error(`Failed to save AT error for ${requestId}: ${error.message}`)
  }
}
