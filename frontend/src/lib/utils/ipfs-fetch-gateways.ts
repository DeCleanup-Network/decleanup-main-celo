import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

const PUBLIC_GATEWAY_BASES = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://w3s.link/ipfs/',
] as const

/** Gateway order: Pinata (upload target) first, then public mirrors. */
export function getIpfsGatewayBases(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (base: string) => {
    const normalized = base.endsWith('/') ? base : `${base}/`
    if (seen.has(normalized)) return
    seen.add(normalized)
    out.push(normalized)
  }

  const custom = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim()
  if (custom) add(custom)

  for (const base of PUBLIC_GATEWAY_BASES) add(base)
  return out
}

export function normalizeIpfsCid(raw: string): string {
  return raw.replace(/^ipfs:\/\//i, '').split('?')[0].split('#')[0].trim()
}

export type IpfsGatewayFetchResult = {
  response: Response
  gatewayUrl: string
}

/**
 * Try each allowed HTTPS gateway until one returns HTTP 2xx.
 * Safe for API routes and server-side rendering (no server-only guard).
 */
export async function fetchFromIpfsGateways(
  rawCid: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<IpfsGatewayFetchResult> {
  const cid = normalizeIpfsCid(rawCid)
  if (!cid) {
    throw new Error('Missing IPFS CID')
  }

  const perGatewayMs = options?.timeoutMs ?? 14_000
  let lastStatus = 0
  let lastHost = ''

  for (const base of getIpfsGatewayBases()) {
    const gatewayUrl = `${base}${cid}`
    let parsed: URL
    try {
      parsed = new URL(gatewayUrl)
    } catch {
      continue
    }
    if (!isAllowedIpfsFetchHost(parsed.hostname)) continue

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), perGatewayMs)
    const onAbort = () => controller.abort()
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeout)
        throw new DOMException('Aborted', 'AbortError')
      }
      options.signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      const response = await fetch(gatewayUrl, {
        headers: { Accept: 'application/json, text/plain, */*' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (response.ok) {
        return { response, gatewayUrl }
      }
      lastStatus = response.status
      lastHost = parsed.hostname
    } catch {
      lastHost = parsed.hostname
    } finally {
      clearTimeout(timeout)
      if (options?.signal) options.signal.removeEventListener('abort', onAbort)
    }
  }

  throw new Error(
    lastStatus
      ? `IPFS gateways failed (last HTTP ${lastStatus} from ${lastHost || 'gateway'})`
      : 'IPFS gateways failed'
  )
}
