/** Web3Auth cache keys that can hold a stale chain (e.g. 0xAD7A08). Clear after logout so next login uses defaultChainId. */
const WEB3AUTH_CACHE_KEYS = [
  'Web3Auth-cachedAdapter',
  'openlogin_store',
]

/**
 * Clears Web3Auth / MetaMask SDK stored data.
 * Use when you see "aes/gcm: invalid ghash tag" or other decrypt errors
 * (usually caused by stale or corrupted encrypted data in localStorage/sessionStorage).
 * Also removes Web3Auth cache keys so next login uses defaultChainId (Celo Sepolia).
 */
export function clearWeb3AuthStorage(): void {
  if (typeof window === 'undefined') return
  try {
    WEB3AUTH_CACHE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      } catch {
        // ignore
      }
    })
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // ignore
  }
}

/** Clears storage and reloads the current page. */
export function clearWeb3AuthStorageAndReload(): void {
  clearWeb3AuthStorage()
  if (typeof window !== 'undefined') window.location.reload()
}

/** Clears storage and redirects to the given path (default /). Use for /reset-wallet-session so we don't reload the same URL. */
export function clearWeb3AuthStorageAndRedirect(path = '/'): void {
  clearWeb3AuthStorage()
  if (typeof window !== 'undefined') window.location.href = path
}

/** Message patterns that indicate a stale/invalid Web3Auth session (SDK throws these on restore). */
export const SESSION_EXPIRED_PATTERNS = [
  'Session Expired or Invalid public key',
  'authorization failed',
  'Invalid public key',
] as const

/** Returns true if the error message indicates session expired or invalid public key. */
export function isSessionExpiredError(message: string): boolean {
  const lower = message.toLowerCase()
  return SESSION_EXPIRED_PATTERNS.some(
    (p) => lower.includes(p.toLowerCase())
  )
}
