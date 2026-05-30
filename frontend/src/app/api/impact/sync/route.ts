/**
 * POST /api/impact/sync
 *
 * Rebuild cleanup_feed from chain + IPFS. Protect with IMPACT_SYNC_SECRET header or query ?secret=
 */
import { NextRequest, NextResponse } from 'next/server'
import { syncCleanupFeedFromChain } from '@/lib/impact/cleanup-feed-sync'
import { isCleanupFeedConfigured } from '@/lib/supabase/cleanup-feed'

export const runtime = 'nodejs'
export const maxDuration = 120

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.IMPACT_SYNC_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  const header = request.headers.get('x-impact-sync-secret')?.trim()
  const query = request.nextUrl.searchParams.get('secret')?.trim()
  return header === secret || query === secret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isCleanupFeedConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const result = await syncCleanupFeedFromChain()
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      chainId: result.chainId,
      syncedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[POST /api/impact/sync]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
