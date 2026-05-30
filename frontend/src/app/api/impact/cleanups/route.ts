/**
 * GET /api/impact/cleanups?limit=20&offset=0
 *
 * Public feed of verified cleanups for landing page (location, weight, recyclables, media).
 * Backed by Supabase `cleanup_feed`, synced from chain + IPFS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { rowToPublicFeedItem } from '@/lib/impact/cleanup-feed-format'
import { ensureCleanupFeedSynced } from '@/lib/impact/cleanup-feed-sync'
import { isCleanupFeedConfigured, listCleanupFeed } from '@/lib/supabase/cleanup-feed'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

const CACHE_HEADER = 'public, s-maxage=300, stale-while-revalidate=3600'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } })
}

export async function GET(request: NextRequest) {
  try {
    if (!isCleanupFeedConfigured()) {
      return NextResponse.json(
        {
          error: 'Cleanup feed not configured. Set Supabase credentials and run migration 20260530_create_cleanup_feed.',
        },
        { status: 503, headers: CORS_HEADERS }
      )
    }

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const offsetRaw = Number(request.nextUrl.searchParams.get('offset') ?? '0')
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 20
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0

    await ensureCleanupFeedSynced({ maxAgeMinutes: 60 })

    const { items, total } = await listCleanupFeed({
      chainId: REQUIRED_CHAIN_ID,
      limit,
      offset,
    })

    return NextResponse.json(
      {
        chainId: REQUIRED_CHAIN_ID,
        total,
        limit,
        offset,
        items: items.map(rowToPublicFeedItem),
        lastUpdated: items[0]?.synced_at ?? null,
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_HEADER } }
    )
  } catch (e) {
    console.error('[GET /api/impact/cleanups]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load cleanup feed' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
