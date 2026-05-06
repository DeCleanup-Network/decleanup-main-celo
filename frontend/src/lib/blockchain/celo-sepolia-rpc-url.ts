import { resolveCeloSepoliaUpstreamRpc, CELO_SEPOLIA_FORNO_RPC } from './celo-sepolia-upstream-rpc'

/**
 * URL used by wagmi/viem HTTP transport for Celo Sepolia (11142220).
 * Prefer same-origin proxy in the browser so public forno endpoints
 * (often no CORS for browser fetch) do not break readContract.
 */
/**
 * RPC URL for Web3Auth `rpcTarget`. JSON-RPC runs inside https://wallet.web3auth.io, which must not
 * target http://localhost (browsers block cross-origin access to loopback / private network).
 * Use the public upstream URL when the dapp is on localhost; elsewhere match {@link getCeloSepoliaHttpRpcUrl}.
 */
export function getCeloSepoliaRpcTargetForWeb3Auth(): string {
  const direct = resolveCeloSepoliaUpstreamRpc(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || CELO_SEPOLIA_FORNO_RPC
  )
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') {
      return direct
    }
  } else if (process.env.NODE_ENV === 'development') {
    return direct
  }
  return getCeloSepoliaHttpRpcUrl()
}

export function getCeloSepoliaHttpRpcUrl(): string {
  const direct = resolveCeloSepoliaUpstreamRpc(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || CELO_SEPOLIA_FORNO_RPC
  )

  if (typeof window !== 'undefined' && window.location?.origin) {
    // In Web3Auth / embedded iframes, `origin` is not the dapp — same-origin proxy would point at the wrong host.
    const inIframe =
      typeof window.self !== 'undefined' &&
      typeof window.top !== 'undefined' &&
      window.self !== window.top
    if (inIframe) {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        ''
      if (base) {
        try {
          const u = new URL(base)
          // Web3Auth iframe cannot access localhost loopback from wallet.web3auth.io.
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            return direct
          }
          return `${u.origin}/api/rpc/celo-sepolia`
        } catch {
          /* fall through */
        }
      }
      // In iframes with no public app URL configured, use direct upstream RPC.
      return direct
    }
    return `${window.location.origin}/api/rpc/celo-sepolia`
  }
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
