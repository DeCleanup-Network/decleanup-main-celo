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

    // Fetch applications and stats (degrade gracefully — same as ?address= branch)
    let applications: Awaited<ReturnType<typeof getAllApplications>> = []
    let stats: Awaited<ReturnType<typeof getApplicationStats>> = {
      total: 0,
      pending: 0,
      approvalPendingOnchain: 0,
      approved: 0,
      rejected: 0,
    }
    let verifierApplicationsUnavailable = false
    try {
      const [apps, st] = await Promise.all([getAllApplications(), getApplicationStats()])
      applications = apps
      stats = st
      console.log(`📊 Fetched ${applications.length} verifier applications`)
    } catch (err) {
      console.error('GET /api/verifier/applications (list):', err)
      verifierApplicationsUnavailable = true
      try {
        stats = await getApplicationStats()
      } catch {
        /* keep zeros */
      }
    }

    return NextResponse.json(
      {
        success: true,
        applications,
        stats,
        ...(verifierApplicationsUnavailable ? { verifierApplicationsUnavailable: true } : {}),
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
