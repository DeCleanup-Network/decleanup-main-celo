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
