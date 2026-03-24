import { NextRequest, NextResponse } from 'next/server'
import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

export const runtime = 'nodejs'

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

  const upstream = await fetch(raw, {
    headers: { Accept: '*/*' },
    next: { revalidate: 3600 },
  })

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
