import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

/**
 * Rewrites public IPFS gateway URLs to same-origin /api/ipfs/fetch in the browser
 * so images/videos/metadata avoid third-party CORS and Pinata 429s from localhost/Safari.
 */
export function proxyIpfsHttpUrl(url: string): string {
  if (typeof window === 'undefined') return url
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url
  try {
    const u = new URL(url)
    if (isAllowedIpfsFetchHost(u.hostname)) {
      return `/api/ipfs/fetch?url=${encodeURIComponent(url)}`
    }
  } catch {
    /* ignore */
  }
  return url
}

/** Fetch JSON/metadata from a public gateway via same-origin proxy when in the browser. */
export async function fetchViaIpfsGatewayProxy(url: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(url)
      if (isAllowedIpfsFetchHost(u.hostname)) {
        return fetch(`/api/ipfs/fetch?url=${encodeURIComponent(url)}`, init)
      }
    } catch {
      /* ignore */
    }
  }
  return fetch(url, init)
}
