/**
 * POST /api/verifier/review
 * 
 * Admin endpoint: Approve or reject application
 * 
 * Flow:
 * 1. Validate request (admin check - TODO)
 * 2. Get application
 * 3. Update status
 * 4. If APPROVE: Call grantRole() on contract
 * 5. Return result
 * 
 * ⚠️ TODO: Add admin role verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateApplicationStatus, getApplicationById } from '@/lib/verifier/applications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { applicationId, decision, reviewedBy, notes } = body

    // Validate input
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

    // TODO: Add admin role check here
    // if (!await isAdmin(reviewedBy)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    // Get application
    const app = getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Check if already reviewed
    if (app.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Application already ${app.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    // Update status
    const updated = updateApplicationStatus(
      applicationId,
      decision as 'APPROVED' | 'REJECTED',
      reviewedBy || 'admin',
      notes
    )

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update application' },
        { status: 500 }
      )
    }

    // If APPROVE: Call grantRole on contract
    if (decision === 'APPROVE') {
      // TODO: Call grantRole(VERIFIER_ROLE, app.address) here
      // This will be implemented after reviewing contracts.ts
      console.log(`📝 TODO: Grant VERIFIER_ROLE to ${app.address}`)
    }

    console.log(`✅ Application ${applicationId} ${decision.toLowerCase()} by ${reviewedBy}`)

    return NextResponse.json(
      {
        success: true,
        application: updated,
        message: `Application ${decision.toLowerCase()} successfully`,
      }
    )

  } catch (error) {
    console.error('Error in POST /api/verifier/review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
