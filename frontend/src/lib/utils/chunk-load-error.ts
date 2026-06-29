const RELOAD_AT_KEY = 'decleanup-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

/** True when a lazy-loaded Next.js chunk is missing (common after a new deploy + stale tab). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const name = error instanceof Error ? error.name : ''
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error:\s*https?:\/\/.*\/_next\/static\/chunks\//i.test(message)
  )
}

export function chunkLoadErrorMessage(): string {
  return 'A new version of the app was deployed. Refresh the page to load the impact portfolio.'
}

/**
 * Hard-reload once when stale chunks are detected. Cooldown prevents reload loops.
 * @returns true if a reload was triggered
 */
export function reloadOnceForStaleChunk(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const now = Date.now()
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0)
    if (last > 0 && now - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_AT_KEY, String(now))
  } catch {
    // sessionStorage blocked — still attempt one reload
  }
  window.location.reload()
  return true
}
