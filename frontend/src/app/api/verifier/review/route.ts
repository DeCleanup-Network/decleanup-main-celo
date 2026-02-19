/**
 * POST /api/verifier/review
 * 
 * Admin endpoint: Approve or reject verifier application
 * 
 * IMPORTANT: grantRole must be called CLIENT-SIDE before this endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { getApplicationById, updateApplicationStatus, lockApplication, unlockApplication, logAuditEvent } from '@/lib/supabase/applications'
import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { validateInput, VerifierReviewSchema } from '@/lib/validation/verifier-schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let applicationId: string | null = null
  let locked = false

  try {
    const body = await request.json()

    // STEP 1: Validate input
    const validation = validateInput(VerifierReviewSchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.errors.flatten(),
        },
        { status: 400 }
      )
    }

    const { applicationId: appId, decision, reviewedBy, notes } = validation.data
    applicationId = appId

    // STEP 2: 🔴 CRITICAL - Verify admin role on-chain
    const isAdmin = await isAdminOnChain(reviewedBy)
    if (!isAdmin) {
      console.warn(`⛔ Non-admin tried to review application: ${reviewedBy}`)
      await logAuditEvent(applicationId, 'UNAUTHORIZED_ATTEMPT', reviewedBy, {
        reason: 'Not admin role',
      })
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can review applications.' },
        { status: 403 }
      )
    }

    // STEP 3: Get application
    const app = await getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // STEP 4: Check status
    if (app.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Application already ${app.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    // STEP 5: 🔴 CRITICAL - Lock application to prevent race conditions
    locked = await lockApplication(applicationId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Application is being processed. Try again.' },
        { status: 409 }
      )
    }

    // STEP 6: If APPROVE - just update status (grantRole called client-side)
    if (decision === 'APPROVE') {
      const updated = await updateApplicationStatus(
        applicationId,
        'APPROVED',
        reviewedBy,
        notes
      )

      // Audit log
      await logAuditEvent(applicationId, 'APPROVED', reviewedBy, {
        notes,
      })

      return NextResponse.json({
        success: true,
        application: updated,
        message: 'Application approved. User must call grantRole client-side.',
      })
    }

    // STEP 7: If REJECT - update status
    if (decision === 'REJECT') {
      const updated = await updateApplicationStatus(
        applicationId,
        'REJECTED',
        reviewedBy,
        notes
      )

      // Audit log
      await logAuditEvent(applicationId, 'REJECTED', reviewedBy, { notes })

      return NextResponse.json({
        success: true,
        application: updated,
        message: 'Application rejected',
      })
    }

  } catch (error) {
    console.error('Error in POST /api/verifier/review:', error)

    // Unlock if locked
    if (applicationId && locked) {
      await unlockApplication(applicationId)
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )

  } finally {
    // Always unlock if we locked it
    if (applicationId && locked) {
      await unlockApplication(applicationId)
    }
  }
}
