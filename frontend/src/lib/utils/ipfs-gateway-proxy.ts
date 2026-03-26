import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

/** Prefer ipfs.io for the encoded upstream URL so Pinata is not the first hop (429 / CORP on hotlinking). */
const DEFAULT_HTTPS_IPFS_PREFIX = 'https://ipfs.io/ipfs/'

/**
 * Turn `ipfs://...` or bare paths into an https gateway URL (used before proxying).
 */
export function normalizeToHttpsIpfsUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('ipfs://')) {
    let path = trimmed.replace(/^ipfs:\/\//, '').replace(/\/+/g, '/')
    if (path.startsWith('/')) path = path.slice(1)
    return `${DEFAULT_HTTPS_IPFS_PREFIX}${path}`
  }
  return trimmed
}

/**
 * Rewrites public IPFS gateway URLs to same-origin `/api/ipfs/fetch` (SSR-safe).
 * Direct `gateway.pinata.cloud` / other gateways in `<img src>` hit CORS, 429, and
 * Cross-Origin-Resource-Policy blocks in Safari; same-origin proxy avoids that.
 */
export function proxyIpfsHttpUrl(url: string): string {
  const httpsUrl = normalizeToHttpsIpfsUrl(url)
  if (!httpsUrl.startsWith('http://') && !httpsUrl.startsWith('https://')) return url.trim()
  try {
    const u = new URL(httpsUrl)
    if (isAllowedIpfsFetchHost(u.hostname)) {
      return `/api/ipfs/fetch?url=${encodeURIComponent(httpsUrl)}`
    }
  } catch {
    /* ignore */
  }
  return httpsUrl
}

/** Fetch JSON/metadata from a public gateway via same-origin proxy in the browser; server uses direct fetch. */
export async function fetchViaIpfsGatewayProxy(url: string, init?: RequestInit): Promise<Response> {
  const httpsUrl = normalizeToHttpsIpfsUrl(url)
  const target = httpsUrl.startsWith('http://') || httpsUrl.startsWith('https://') ? httpsUrl : url
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(target)
      if (isAllowedIpfsFetchHost(u.hostname)) {
        return fetch(`/api/ipfs/fetch?url=${encodeURIComponent(target)}`, init)
      }
    } catch {
      /* ignore */
    }
  }
  return fetch(target, init)
}
