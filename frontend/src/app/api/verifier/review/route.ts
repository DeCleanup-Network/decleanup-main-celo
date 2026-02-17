/**
 * POST /api/verifier/review
 * Admin endpoint: Update verifier application status
 * 
 * NOTE: Role grant happens CLIENT-SIDE before calling this
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { updateApplicationStatus, getApplicationById } from '@/lib/verifier/applications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { applicationId, decision, reviewedBy, notes } = body

    if (!applicationId || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields: applicationId, decision' },
        { status: 400 }
      )
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be APPROVE or REJECT' },
        { status: 400 }
      )
    }

    if (!reviewedBy || !isAddress(reviewedBy)) {
      return NextResponse.json(
        { error: 'Missing or invalid reviewedBy address' },
        { status: 400 }
      )
    }

    const app = getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    if (app.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Application already ${app.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    const updated = updateApplicationStatus(
      applicationId,
      decision as 'APPROVED' | 'REJECTED',
      reviewedBy,
      notes
    )

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      application: updated,
      message: `Application ${decision.toLowerCase()} successfully`,
    })

  } catch (error) {
    console.error('Error in POST /api/verifier/review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
