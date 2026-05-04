/** Default TTL for deduplicating repeated contract reads (home poll, verification paths). */
export const CONTRACT_READ_TTL_MS = 30_000

type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()

/** Drop cached reads so the next fetch hits the chain (e.g. after mint/claim). */
export function invalidateImpactProductClaimCaches(params: {
  chainId: number
  ownerAddress: string
  cleanupId?: bigint
}): void {
  const low = params.ownerAddress.toLowerCase()
  store.delete(`userLevel:${params.chainId}:${low}`)
  store.delete(`dcuBalance:${params.chainId}:${low}`)
  if (params.cleanupId !== undefined) {
    store.delete(`details:${params.chainId}:${params.cleanupId.toString()}`)
  }
}

/** After approve/reject submission, drop cached `getSubmissionDetails` so the UI refetch sees on-chain status. */
export function invalidateSubmissionDetailsCache(chainId: number, submissionId: bigint): void {
  store.delete(`details:${chainId}:${submissionId.toString()}`)
}

/**
 * In-memory time-based cache for async contract reads. Not shared across tabs/workers.
 */
export async function withContractCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expiresAt > now) {
    return hit.value
  }
  const value = await fn()
  store.set(key, { value, expiresAt: now + ttlMs })
  return value
}
