/**
 * Impact Indexer
 * 
 * Responsabilidades:
 * 1. Fetch all approved submissions from contract
 * 2. Resolve IPFS impact data (parallel with concurrency limit)
 * 3. Normalize all units to base (sqm, kg, minutes)
 * 4. Return ImpactEntry[] + manage cache (1h TTL)
 * 
 * Architecture:
 * - In-memory cache (survives session)
 * - TTL-based invalidation
 * - Parallel IPFS resolution with backpressure
 * - Graceful error handling (skip bad entries, continue)
 * 
 * ⚠️ Scalability notes:
 * - Current approach works well up to ~5k submissions
 * - Future: Implement event indexing or subgraph for larger scale
 * - On serverless: Each cold start clears cache (acceptable for A-Lite)
 *   Future: Use Redis or persistent cache layer
 */

import { getCleanupDetails, getCleanupCounter } from '@/lib/blockchain/contracts'
import { fetchIpfsByCid } from '@/lib/utils/ipfs-gateway-proxy'
import { ImpactEntry, ImpactIndexCache } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_TTL_MINUTES = 60
/** Keep low to avoid Pinata/public gateway 429s when many CIDs resolve at once. */
const IPFS_PARALLEL_LIMIT = 3
const IPFS_TIMEOUT_MS = 28_000

// ============================================================================
// CACHE STATE
// ============================================================================

let cachedIndex: ImpactIndexCache | null = null
let rebuildInFlight: Promise<ImpactEntry[]> | null = null

// ============================================================================
// PUBLIC: Get Impact Index (with caching)
// ============================================================================

export async function getImpactIndex(): Promise<ImpactEntry[]> {
  const now = Date.now()
  
  if (cachedIndex && cachedIndex.expiresAt > now) {
    const staleSubmitter = cachedIndex.entries.some(
      (e) => !e.submitter || String(e.submitter).trim() === ''
    )
    if (staleSubmitter) {
      console.warn('⚠️ Invalidating impact cache (entries missing submitter; use submission.user)')
      cachedIndex = null
    } else {
      console.log(
        `📦 Returning cached impact index (${cachedIndex.entries.length} entries)`
      )
      return cachedIndex.entries
    }
  }

  // Single-flight guard: prevent duplicate rebuilds running in parallel on first load.
  if (rebuildInFlight) {
    console.log('⏭️ Impact index rebuild already in progress; skipping duplicate trigger')
    return rebuildInFlight
  }

  console.log('🔄 Rebuilding impact index from contract + IPFS...')

  rebuildInFlight = (async () => {
    try {
    const submissionCountBig = await getCleanupCounter()
    const submissionCount = Number(submissionCountBig)
    const count = Number(submissionCount)
    console.log(`📊 Found ${count} total submissions`)
    
    const submissions = await Promise.allSettled(
      Array.from({ length: count }, (_, i) =>
        getCleanupDetails(BigInt(i))
      )
    )
    
    const approvedSubmissions = submissions
      .map((result) => result)
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value)
      .filter(
        (submission) =>
          submission.verified === true && submission.rejected !== true
      )
    
    console.log(`✅ Filtered to ${approvedSubmissions.length} approved submissions`)
    
    const entries = await resolveIPFSDataWithConcurrency(
      approvedSubmissions,
      IPFS_PARALLEL_LIMIT
    )
    
    const normalizedEntries = entries
      .filter((entry): entry is ImpactEntry => entry !== null)
      .map(normalizeEntry)
    
    const expiresAt = now + CACHE_TTL_MINUTES * 60 * 1000
    cachedIndex = {
      entries: normalizedEntries,
      generatedAt: now,
      expiresAt,
      ttlMinutes: CACHE_TTL_MINUTES,
    }
    
    console.log(`✅ Built impact index: ${normalizedEntries.length} entries`)
    
      return normalizedEntries
    } catch (error) {
      console.error('🔴 Failed to build impact index:', error)

      if (cachedIndex) {
        console.warn('⚠️ Using stale cache as fallback')
        return cachedIndex.entries
      }

      return []
    } finally {
      rebuildInFlight = null
    }
  })()

  return rebuildInFlight
}

// ============================================================================
// INTERNAL: Resolve IPFS with Concurrency Control
// ============================================================================

async function resolveIPFSDataWithConcurrency(
  submissions: any[],
  limit: number
): Promise<(any | null)[]> {
  const results: (any | null)[] = new Array(submissions.length)
  
  for (let i = 0; i < submissions.length; i += limit) {
    const batch = submissions.slice(i, i + limit)
    const batchResults = await Promise.allSettled(
      batch.map((submission, batchIndex) =>
        resolveSubmissionIPFSData(submission, i + batchIndex)
      )
    )
    
    batchResults.forEach((result, batchIndex) => {
      const globalIndex = i + batchIndex
      if (result.status === 'fulfilled') {
        results[globalIndex] = result.value
      } else {
        console.warn(
          `⚠️ Failed to resolve IPFS for submission ${submissions[globalIndex]?.id}:`,
          result.reason
        )
        results[globalIndex] = null
      }
    })
  }
  
  return results
}

async function resolveSubmissionIPFSData(
  submission: any,
  index: number
): Promise<any | null> {
  if (!submission.impactFormDataHash) {
    return submission
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IPFS_TIMEOUT_MS)

    const raw = String(submission.impactFormDataHash || '')
    const cleanHash = raw.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0].trim()
    if (!cleanHash) {
      clearTimeout(timeout)
      return submission
    }

    const response = await fetchIpfsByCid(cleanHash, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      let detail = ''
      try {
        const errBody = await response.json()
        if (errBody && typeof errBody === 'object' && 'error' in errBody) {
          detail = String((errBody as { error?: string }).error)
        }
      } catch {
        detail = await response.text().catch(() => '')
      }
      throw new Error(detail || `IPFS gateways failed (HTTP ${response.status})`)
    }

    const text = await response.text()
    const trimmed = text.trim()
    if (trimmed.startsWith('<')) {
      throw new Error('IPFS gateway returned HTML instead of JSON')
    }
    const impactData = JSON.parse(trimmed) as Record<string, unknown>
    
    return {
      ...submission,
      impactData,
      _ipfsResolved: true,
    }
    
  } catch (error) {
    console.warn(
      `⚠️ IPFS resolution failed for ${submission.impactFormDataHash}:`,
      error instanceof Error ? error.message : String(error)
    )
    
    return submission
  }
}

// ============================================================================
// INTERNAL: Normalize Entry
// ============================================================================

function normalizeEntry(submission: any): ImpactEntry {
  const impactData = submission.impactData || {}
  
  const areaSqm = normalizeArea(
    parseFloat(impactData.area) || 0,
    impactData.areaUnit || 'sqm'
  )
  
  const weightKg = normalizeWeight(
    parseFloat(impactData.weight) || 0,
    impactData.weightUnit || 'kg'
  )
  
  const totalMinutes = normalizeTime(
    parseInt(impactData.hours) || 0,
    parseInt(impactData.minutes) || 0
  )
  
  const wasteTypesArray = Array.isArray(impactData.wasteTypes)
    ? impactData.wasteTypes
    : []
  
  const contributorsArray = Array.isArray(impactData.contributors)
    ? [...new Set(impactData.contributors as string[])]
    : []
  
  const submitterAddr = submission.user ?? submission.submitter
  const entry: ImpactEntry = {
    submissionId: submission.id.toString(),
    submitter: submitterAddr ? String(submitterAddr) : '0x0000000000000000000000000000000000000000',
    timestamp: Number(submission.timestamp),
    latitude: Number(submission.latitude) / 1_000_000,
    longitude: Number(submission.longitude) / 1_000_000,
    
    locationType: impactData.locationType || 'Unknown',
    areaSqm,
    weightKg,
    bags: parseInt(impactData.bags) || 0,
    totalMinutes,
    wasteTypes: wasteTypesArray,
    contributors: contributorsArray,
    
    environmentalChallenges: impactData.environmentalChallenges || undefined,
    preventionIdeas: impactData.preventionIdeas || undefined,
    additionalNotes: impactData.additionalNotes || undefined,
    
    ipfsHash: submission.impactFormDataHash,
    resolvedAt: Date.now(),
  }
  
  return entry
}

// ============================================================================
// INTERNAL: Unit Converters
// ============================================================================

function normalizeArea(value: number, unit: string): number {
  if (unit === 'sqft') {
    return value / 10.764
  }
  return value
}

function normalizeWeight(value: number, unit: string): number {
  if (unit === 'lbs') {
    return value / 2.20462
  }
  return value
}

function normalizeTime(hours: number, minutes: number): number {
  return hours * 60 + minutes
}

// ============================================================================
// PUBLIC: Cache Management
// ============================================================================

export function invalidateImpactCache(): void {
  cachedIndex = null
  console.log('🔄 Impact cache invalidated')
}

export async function refreshImpactCache(): Promise<ImpactEntry[]> {
  invalidateImpactCache()
  return getImpactIndex()
}

export function getCacheStatus() {
  const now = Date.now()
  
  if (!cachedIndex) {
    return {
      status: 'empty',
      entries: 0,
      generatedAt: null,
      expiresAt: null,
      ttlMinutes: 0,
    }
  }
  
  return {
    status: cachedIndex.expiresAt > now ? 'valid' : 'expired',
    entries: cachedIndex.entries.length,
    generatedAt: new Date(cachedIndex.generatedAt).toISOString(),
    expiresAt: new Date(cachedIndex.expiresAt).toISOString(),
    ttlMinutes: cachedIndex.ttlMinutes,
    remainingMinutes: Math.round((cachedIndex.expiresAt - now) / 1000 / 60),
  }
}
