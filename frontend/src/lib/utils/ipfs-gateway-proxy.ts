import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'
import { fetchFromIpfsGateways } from '@/lib/utils/ipfs-fetch-gateways'

/** On-chain tokenURI may be `data:application/json;base64,...` — decode locally (CSP blocks fetch to data:). */
function responseFromDataUri(url: string): Response | null {
  const trimmed = url.trim()
  if (!trimmed.startsWith('data:')) return null
  const comma = trimmed.indexOf(',')
  if (comma < 0) return null
  const meta = trimmed.slice(5, comma)
  const payload = trimmed.slice(comma + 1)
  const segments = meta.split(';').filter(Boolean)
  const mime = segments[0] || 'text/plain'
  const isBase64 = segments.includes('base64')
  let body: string
  try {
    if (isBase64) {
      body =
        typeof Buffer !== 'undefined'
          ? Buffer.from(payload, 'base64').toString('utf-8')
          : atob(payload)
    } else {
      body = decodeURIComponent(payload)
    }
  } catch {
    return null
  }
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': mime },
  })
}

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

/** Fetch by CID via same-origin proxy (tries Pinata + public gateways on the server). */
export async function fetchIpfsByCid(cid: string, init?: RequestInit): Promise<Response> {
  const clean = cid.replace(/^ipfs:\/\//i, '').split('?')[0].split('#')[0].trim()
  if (!clean) {
    return new Response(null, { status: 400, statusText: 'Missing CID' })
  }
  if (typeof window !== 'undefined') {
    return fetch(`/api/ipfs/fetch?cid=${encodeURIComponent(clean)}`, init)
  }
  const { response } = await fetchFromIpfsGateways(clean, { signal: init?.signal ?? undefined })
  return response
}

/** Fetch JSON/metadata from a public gateway via same-origin proxy in the browser; server uses direct fetch. */
export async function fetchViaIpfsGatewayProxy(url: string, init?: RequestInit): Promise<Response> {
  const dataResponse = responseFromDataUri(url)
  if (dataResponse) return dataResponse

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
