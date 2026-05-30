/**
 * GET /api/impact/global
 *
 * Aggregated impact metrics for landing (weight, area, recyclables, waste breakdown).
 */
import { NextResponse } from 'next/server'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { ensureCleanupFeedSynced } from '@/lib/impact/cleanup-feed-sync'
import { getCleanupFeedGlobalStats, isCleanupFeedConfigured } from '@/lib/supabase/cleanup-feed'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

const CACHE_HEADER = 'public, s-maxage=3600, stale-while-revalidate=86400'

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${h} hours`
  const days = Math.floor(h / 24)
  return `${days} days`
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } })
}

export async function GET() {
  try {
    if (!isCleanupFeedConfigured()) {
      return NextResponse.json(
        { error: 'Impact feed not configured (Supabase).' },
        { status: 503, headers: CORS_HEADERS }
      )
    }

    await ensureCleanupFeedSynced({ maxAgeMinutes: 60 })
    const stats = await getCleanupFeedGlobalStats(REQUIRED_CHAIN_ID)

    const wasteTypeBreakdown = Object.entries(stats.wasteTypeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: stats.totalCleanups > 0 ? (count / stats.totalCleanups) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const topLocations = stats.topLocations.map((row) => ({
      location: row.location,
      cleanups: row.cleanups,
      percentage: stats.totalCleanups > 0 ? (row.cleanups / stats.totalCleanups) * 100 : 0,
    }))

    return NextResponse.json(
      {
        project: 'DeCleanup Network',
        chainId: REQUIRED_CHAIN_ID,
        metrics: {
          total_cleanups_verified: stats.totalCleanups,
          total_weight_kg: Math.round(stats.totalWeightKg * 10) / 10,
          total_area_sqm: Math.round(stats.totalAreaSqm * 10) / 10,
          total_bags: stats.totalBags,
          total_volunteer_time: fmtHours(stats.totalDurationMinutes),
          total_duration_minutes: stats.totalDurationMinutes,
          cleanups_with_recyclables: stats.cleanupsWithRecyclables,
          total_recyclables_kg: Math.round(stats.totalRecyclablesKg * 10) / 10,
          waste_type_breakdown: wasteTypeBreakdown,
          top_locations: topLocations,
        },
        last_updated: new Date().toISOString(),
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_HEADER } }
    )
  } catch (e) {
    console.error('[GET /api/impact/global]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load global impact' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
