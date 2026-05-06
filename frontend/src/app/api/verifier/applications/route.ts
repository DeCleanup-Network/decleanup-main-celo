/**
 * GET /api/verifier/applications
 * 
 * Admin endpoint: Get all applications
 * Returns list of applications + stats
 */

import { NextResponse } from 'next/server'
import { getAllApplications, getApplicationStats, getLatestApplicationByAddress } from '@/lib/supabase/applications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.trim().toLowerCase()

    if (address) {
      try {
        const application = await getLatestApplicationByAddress(address)
        return NextResponse.json(
          {
            success: true,
            application,
          },
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        )
      } catch (err) {
        // Local/dev: missing service role, table not migrated, or bad JWT — do not break cleanup UX.
        console.error('GET /api/verifier/applications (by address):', err)
        return NextResponse.json(
          {
            success: true,
            application: null,
            verifierApplicationsUnavailable: true,
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        )
      }
    }

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
