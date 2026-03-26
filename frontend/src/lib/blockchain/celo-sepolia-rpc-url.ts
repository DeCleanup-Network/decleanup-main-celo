const PUBLIC_CELO_SEPOLIA_FALLBACK = 'https://celo-sepolia.drpc.org'

/**
 * True if URL must never be used inside Web3Auth’s iframe (wallet.web3auth.io): loopback or our Next proxy.
 */
function isUnsafeRpcForWeb3AuthIframe(url: string): boolean {
  const t = url.trim()
  if (!t) return true
  try {
    const u = new URL(t)
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
    if (u.pathname.includes('/api/rpc')) return true
  } catch {
    return true
  }
  return false
}

/**
 * Direct public RPC (no same-origin proxy). Use for Web3Auth / any iframe whose origin is not your app:
 * browsers block https://wallet.web3auth.io → http://127.0.0.1 (Private Network Access / loopback).
 *
 * Never returns localhost or `/api/rpc/*` — even if NEXT_PUBLIC_SEPOLIA_RPC_URL was mistakenly set to the proxy.
 */
export function getCeloSepoliaHttpRpcUrlDirect(): string {
  const raw = (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || PUBLIC_CELO_SEPOLIA_FALLBACK).trim()
  if (isUnsafeRpcForWeb3AuthIframe(raw)) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[DeCleanup] NEXT_PUBLIC_SEPOLIA_RPC_URL must be a public HTTPS RPC (not localhost or /api/rpc). Using:',
        PUBLIC_CELO_SEPOLIA_FALLBACK
      )
    }
    return PUBLIC_CELO_SEPOLIA_FALLBACK
  }
  return raw
}

/**
 * URL used by wagmi/viem HTTP transport for Celo Sepolia (11142220).
 * Prefer same-origin proxy in the browser so public forno/alfajores endpoints
 * (often no CORS for browser fetch) do not break readContract.
 */
export function getCeloSepoliaHttpRpcUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/rpc/celo-sepolia`
  }
  const direct =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://celo-sepolia.drpc.org'
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (base) {
    try {
      const u = new URL(base)
      return `${u.origin}/api/rpc/celo-sepolia`
    } catch {
      /* fall through */
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api/rpc/celo-sepolia'
  }
  return direct
}
