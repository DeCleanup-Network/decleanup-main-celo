/**
 * Read-only client for the public impact APIs used by /proof.
 * Does not change API routes. Shows Celo mainnet (42220) values as returned.
 */

export const PROOF_IMPACT_ORIGIN = 'https://dapp.decleanup.net'
export const PROOF_CHAIN_ID = 42220

export type ProofCleanupLocation = {
  label?: string
  placeName?: string | null
  coordinates?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type ProofCleanupImpact = {
  weightKg?: unknown
  areaSqm?: unknown
  bags?: unknown
  durationMinutes?: unknown
  wasteTypes?: unknown
  contributorsCount?: unknown
  hasImpactReport?: unknown
  co2eEstimateKg?: unknown
}

export type ProofCleanupRecyclables = {
  hasRecyclables?: boolean
  amountKg?: unknown
  amountDisplay?: string | null
  photoUrl?: string | null
}

export type ProofCleanupMedia = {
  beforePhotoUrl?: string | null
  afterPhotoUrl?: string | null
  hasPublicPhotos?: boolean
}

export type ProofCleanupItem = {
  submissionId: string
  chainId?: number
  verifiedAt?: string | null
  summary?: string
  /** Cleanup submitter wallet (organizer). */
  organizerAddress?: string | null
  submitter?: string | null
  location?: ProofCleanupLocation
  impact?: ProofCleanupImpact
  recyclables?: ProofCleanupRecyclables
  media?: ProofCleanupMedia
  txHash?: string | null
  transactionHash?: string | null
  tx_hash?: string | null
}

export type ProofCleanupsResponse = {
  chainId?: number
  total?: number
  limit?: number
  offset?: number
  items?: ProofCleanupItem[]
  lastUpdated?: string | null
}

export type ProofGlobalResponse = {
  project?: unknown
  chainId?: unknown
  metrics?: Record<string, unknown>
  last_updated?: unknown
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

export function asWalletAddress(value: unknown): string | null {
  const raw = asTrimmedString(value)
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  if (raw.toLowerCase() === '0x0000000000000000000000000000000000000000') return null
  return raw
}

export function exactApiValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export function wasteTypesFromApi(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function transactionHashFromItem(item: ProofCleanupItem): string | null {
  const candidates = [item.txHash, item.transactionHash, item.tx_hash]
  for (const raw of candidates) {
    const hash = asTrimmedString(raw)
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) return hash
  }
  return null
}

export function explorerTxUrl(hash: string): string {
  return `https://celoscan.io/tx/${hash}`
}

export function absoluteMediaUrl(url: string | null | undefined): string | null {
  const raw = asTrimmedString(url)
  if (!raw) return null
  if (raw.startsWith('/api/ipfs/fetch')) return raw
  try {
    const parsed = new URL(raw, PROOF_IMPACT_ORIGIN)
    if (parsed.pathname.startsWith('/api/ipfs/fetch')) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    /* keep going */
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return `/api/ipfs/fetch?url=${encodeURIComponent(raw)}`
  }
  if (raw.startsWith('/')) return `${PROOF_IMPACT_ORIGIN}${raw}`
  return raw
}

export function cidFromMediaUrl(url: string | null | undefined): string | null {
  const raw = asTrimmedString(url)
  if (!raw) return null
  try {
    const parsed = new URL(raw, PROOF_IMPACT_ORIGIN)
    const cidParam = asTrimmedString(parsed.searchParams.get('cid'))
    if (cidParam) return cidParam
    const nested = parsed.searchParams.get('url')
    if (nested) {
      const nestedMatch = nested.match(/\/ipfs\/([a-zA-Z0-9]+)/i)
      if (nestedMatch?.[1]) return nestedMatch[1]
    }
  } catch {
    /* fall through */
  }
  const pathMatch = raw.match(/\/ipfs\/([a-zA-Z0-9]+)/i)
  return pathMatch?.[1] ?? null
}

export type ProofPhotoSlot = { label: string; src: string }

/** Only URLs already present on the public feed. Does not invent photos. */
export function proofPublicPhotos(item: ProofCleanupItem): ProofPhotoSlot[] {
  const slots: ProofPhotoSlot[] = []
  const before = absoluteMediaUrl(item.media?.beforePhotoUrl)
  const after = absoluteMediaUrl(item.media?.afterPhotoUrl)
  const recycled = absoluteMediaUrl(item.recyclables?.photoUrl)
  if (before) slots.push({ label: 'Before', src: before })
  if (after) slots.push({ label: 'After', src: after })
  if (recycled) slots.push({ label: 'Recyclables', src: recycled })
  return slots
}

export type ProofAiReview = {
  summary: string
  verdict?: string
  score?: unknown
  delta?: unknown
  beforeCount?: unknown
  afterCount?: unknown
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function proofAiReviewFromPayload(data: unknown): ProofAiReview | null {
  if (!data || typeof data !== 'object') return null
  const row = data as {
    hasResult?: unknown
    score?: { verdict?: unknown; score?: unknown; delta?: unknown }
    beforeInference?: { objectCount?: unknown }
    afterInference?: { objectCount?: unknown }
  }
  if (row.hasResult === false) return null
  const scoreValue = asFiniteNumber(row.score?.score)
  if (scoreValue == null) return null
  const delta = asFiniteNumber(row.score?.delta)
  const verdict = asTrimmedString(row.score?.verdict ?? null)
  const verdictLine =
    verdict === 'approved'
      ? 'Automated photo check: before and after look consistent with a cleanup.'
      : verdict === 'rejected'
        ? 'Automated photo check flagged this pair for extra human review. A human verifier still made the on-chain decision.'
        : 'Automated photo check ran as guidance for the human verifier.'
  const deltaLabel = delta == null ? null : delta > 0 ? `+${exactApiValue(delta)}` : exactApiValue(delta)
  const scorePart = `Score ${exactApiValue(scoreValue)}`
  const changePart = deltaLabel != null ? `change in detected items: ${deltaLabel}` : null
  const summary = [verdictLine, [scorePart, changePart].filter(Boolean).join(' · ')].join(' ')
  return {
    summary,
    verdict: verdict ?? undefined,
    score: scoreValue,
    delta: delta ?? undefined,
    beforeCount: row.beforeInference?.objectCount,
    afterCount: row.afterInference?.objectCount,
  }
}

export async function fetchProofAiReview(cleanupId: string): Promise<ProofAiReview | null> {
  const id = cleanupId.trim()
  if (!/^[a-zA-Z0-9-_]+$/.test(id)) return null
  try {
    const res = await fetch(
      `${PROOF_IMPACT_ORIGIN}/api/ml-verification/result?cleanupId=${encodeURIComponent(id)}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) return null
    return proofAiReviewFromPayload(await res.json())
  } catch {
    return null
  }
}

/** Skip rows with no place, no verified time, or sentinel GPS 90 / 180. */
export function isUsableProofCleanup(item: ProofCleanupItem): boolean {
  if (item.chainId != null && item.chainId !== PROOF_CHAIN_ID) return false
  if (!asTrimmedString(item.submissionId)) return false
  if (!asTrimmedString(item.location?.placeName ?? null)) return false
  if (!asTrimmedString(item.verifiedAt ?? null)) return false
  const lat = item.location?.latitude
  const lng = item.location?.longitude
  if (lat === 90 && lng === 180) return false
  return true
}

async function getJson<T, U = T>(path: string, map?: (data: T) => U): Promise<U> {
  const res = await fetch(`${PROOF_IMPACT_ORIGIN}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Impact API ${path} returned ${res.status}`)
  }
  const data = (await res.json()) as T
  return (map ? map(data) : (data as unknown as U))
}

function toPublicItem(item: ProofCleanupItem): ProofCleanupItem {
  return {
    submissionId: item.submissionId,
    chainId: item.chainId,
    verifiedAt: item.verifiedAt,
    summary: item.summary,
    organizerAddress: asWalletAddress(item.organizerAddress) ?? asWalletAddress(item.submitter),
    location: {
      placeName: item.location?.placeName ?? null,
      coordinates: item.location?.coordinates ?? null,
    },
    impact: {
      weightKg: item.impact?.weightKg,
      areaSqm: item.impact?.areaSqm,
      bags: item.impact?.bags,
      durationMinutes: item.impact?.durationMinutes,
      wasteTypes: item.impact?.wasteTypes,
      contributorsCount: item.impact?.contributorsCount,
      hasImpactReport: item.impact?.hasImpactReport === true,
      co2eEstimateKg: item.impact?.co2eEstimateKg,
    },
    recyclables: {
      hasRecyclables: item.recyclables?.hasRecyclables === true,
      amountKg: item.recyclables?.amountKg ?? null,
      amountDisplay: item.recyclables?.amountDisplay ?? null,
      photoUrl: item.recyclables?.photoUrl ?? null,
    },
    media: {
      beforePhotoUrl: item.media?.beforePhotoUrl ?? null,
      afterPhotoUrl: item.media?.afterPhotoUrl ?? null,
      hasPublicPhotos: item.media?.hasPublicPhotos === true,
    },
    txHash: transactionHashFromItem(item),
  }
}

export async function fetchProofGlobal(): Promise<ProofGlobalResponse> {
  return getJson<ProofGlobalResponse>('/api/impact/global')
}

function usablePublicItems(page: ProofCleanupsResponse): {
  total: number
  rawCount: number
  items: ProofCleanupItem[]
} {
  const raw = page.items ?? []
  return {
    total: typeof page.total === 'number' ? page.total : raw.length,
    rawCount: raw.length,
    items: raw.filter(isUsableProofCleanup).map(toPublicItem),
  }
}

export async function fetchUsableProofCleanups(): Promise<ProofCleanupItem[]> {
  const pageSize = 50
  const first = await getJson<ProofCleanupsResponse, ReturnType<typeof usablePublicItems>>(
    `/api/impact/cleanups?limit=${pageSize}&offset=0`,
    usablePublicItems
  )
  const items = [...first.items]
  let offset = first.rawCount
  while (offset < first.total) {
    const page = await getJson<ProofCleanupsResponse, ReturnType<typeof usablePublicItems>>(
      `/api/impact/cleanups?limit=${pageSize}&offset=${offset}`,
      usablePublicItems
    )
    if (page.rawCount === 0) break
    items.push(...page.items)
    offset += page.rawCount
  }
  return items
}

export async function fetchUsableProofCleanupById(
  id: string
): Promise<ProofCleanupItem | null> {
  const wanted = id.trim()
  if (!wanted) return null
  const items = await fetchUsableProofCleanups()
  return items.find((item) => item.submissionId === wanted) ?? null
}
