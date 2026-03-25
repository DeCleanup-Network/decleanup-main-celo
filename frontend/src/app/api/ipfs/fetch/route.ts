import { NextRequest, NextResponse } from 'next/server'
import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

export const runtime = 'nodejs'

/** When Pinata or another gateway rate-limits, try public gateways for the same CID. */
const IPFS_CID_FALLBACK_BASES = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
] as const

function extractIpfsCidFromUrl(url: string): string | null {
  const m = url.match(/\/ipfs\/([^?#]+)/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

/**
 * Server-side fetch of IPFS gateway URLs so browsers (esp. Safari) avoid
 * Pinata CORS + rate limits when loading images/metadata from localhost.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw?.trim()) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
  }

  if (!isAllowedIpfsFetchHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  let upstream = await fetch(raw, {
    headers: { Accept: '*/*' },
    next: { revalidate: 3600 },
  })

  const cid = extractIpfsCidFromUrl(raw)
  if (!upstream.ok && cid && (upstream.status === 429 || upstream.status === 503)) {
    for (const base of IPFS_CID_FALLBACK_BASES) {
      const alt = `${base}${cid}`
      try {
        const u = new URL(alt)
        if (!isAllowedIpfsFetchHost(u.hostname)) continue
        const retry = await fetch(alt, {
          headers: { Accept: '*/*' },
          next: { revalidate: 3600 },
        })
        if (retry.ok) {
          upstream = retry
          break
        }
      } catch {
        /* try next */
      }
    }
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
