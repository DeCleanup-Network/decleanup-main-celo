/**
 * GET /api/verifier/applications
 * 
 * Admin endpoint: Get all applications
 * Returns list of applications + stats
 */

import { NextResponse } from 'next/server'
import { getAllApplications, getApplicationStats } from '@/lib/supabase/applications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Fetch applications and stats
    const [applications, stats] = await Promise.all([
      getAllApplications(),
      getApplicationStats(),
    ])

    console.log(`📊 Fetched ${applications.length} verifier applications`)

    return NextResponse.json(
      {
        success: true,
        applications,
        stats,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )

  } catch (error) {
    console.error('Error in GET /api/verifier/applications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
