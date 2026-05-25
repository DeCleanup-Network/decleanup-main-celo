import { NextRequest, NextResponse } from 'next/server'
import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'
import {
  fetchFromIpfsGateways,
  normalizeIpfsCid,
} from '@/lib/utils/ipfs-fetch-gateways'

export const runtime = 'nodejs'

function extractIpfsCidFromUrl(url: string): string | null {
  const m = url.match(/\/ipfs\/([^?#]+)/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

/**
 * Server-side fetch of IPFS content so browsers avoid gateway CORS / 429.
 * Use ?cid=bafy... (preferred) or ?url=https://gateway.../ipfs/CID
 */
export async function GET(req: NextRequest) {
  const cidParam = req.nextUrl.searchParams.get('cid')?.trim()
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim()

  try {
    if (cidParam) {
      const { response } = await fetchFromIpfsGateways(cidParam)
      const contentType = response.headers.get('content-type') || 'application/json'
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      })
    }

    if (!rawUrl) {
      return NextResponse.json({ error: 'Missing cid or url' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    if (!isAllowedIpfsFetchHost(parsed.hostname)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
    }

    const embeddedCid = extractIpfsCidFromUrl(rawUrl)
    if (embeddedCid) {
      const { response } = await fetchFromIpfsGateways(embeddedCid)
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      })
    }

    const upstream = await fetch(rawUrl, {
      headers: { Accept: '*/*' },
      cache: 'no-store',
    })
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IPFS fetch failed'
    const cid = cidParam || (rawUrl ? extractIpfsCidFromUrl(rawUrl) : null)
    return NextResponse.json(
      { error: message, cid: cid ? normalizeIpfsCid(cid) : undefined },
      { status: 502 }
    )
  }
}
