/** Default TTL for deduplicating repeated contract reads (home poll, verification paths). */
export const CONTRACT_READ_TTL_MS = 30_000

type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()

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
