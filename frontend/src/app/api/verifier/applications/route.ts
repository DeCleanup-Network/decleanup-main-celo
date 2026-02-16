/**
 * GET /api/verifier/applications
 * 
 * Admin endpoint: Get all applications
 * Returns: VerifierApplication[]
 * 
 * Future: Add role check (admin only)
 */

import { NextResponse } from 'next/server'
import { getAllApplications, getApplicationStats } from '@/lib/verifier/applications'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const applications = getAllApplications()
    const stats = getApplicationStats()

    console.log(`📊 Fetched ${applications.length} verifier applications`)

    return NextResponse.json(
      {
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
