/**
 * POST /api/verifier/review/init
 *
 * Admin endpoint: start verifier approval without setting APPROVED.
 * Sets status to PENDING_ONCHAIN so frontend can execute grantRole.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getApplicationById,
  lockApplication,
  logAuditEvent,
  unlockApplication,
  updateApplicationStatus,
} from '@/lib/supabase/applications'
import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { validateInput, VerifierReviewInitSchema } from '@/lib/validation/verifier-schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let applicationId: string | null = null
  let locked = false

  try {
    const body = await request.json()
    const validation = validateInput(VerifierReviewInitSchema, body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.errors.flatten(),
        },
        { status: 400 }
      )
    }

    const { applicationId: appId, reviewedBy, notes } = validation.data
    applicationId = appId

    const isAdmin = await isAdminOnChain(reviewedBy)
    if (!isAdmin) {
      console.warn(`⛔ Non-admin tried to init verifier approval: ${reviewedBy}`)
      await logAuditEvent(applicationId, 'UNAUTHORIZED_INIT_ATTEMPT', reviewedBy, {
        reason: 'Not admin role',
      })
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can initialize approval.' },
        { status: 403 }
      )
    }

    const app = await getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    locked = await lockApplication(applicationId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Application is being processed. Try again.' },
        { status: 409 }
      )
    }

    const lockedApp = await getApplicationById(applicationId)
    if (!lockedApp) {
      return NextResponse.json({ error: 'Application not found after lock' }, { status: 404 })
    }

    if (lockedApp.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Application is not eligible for init (${lockedApp.status.toLowerCase()})` },
        { status: 409 }
      )
    }

    let updated
    try {
      updated = await updateApplicationStatus(
        applicationId,
        'PENDING_ONCHAIN',
        reviewedBy,
        notes
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // Backward-compat: some DBs still enforce status check without PENDING_ONCHAIN.
      if (
        message.includes('verifier_applications_status_check') ||
        message.includes('invalid input value for enum')
      ) {
        updated = await updateApplicationStatus(
          applicationId,
          'PENDING' as any,
          reviewedBy,
          notes
        )
      } else {
        throw e
      }
    }

    if (!updated) {
      throw new Error('Failed to update application status')
    }

    await logAuditEvent(applicationId, 'approval_initiated', reviewedBy, {
      notes,
      previousStatus: lockedApp.status,
      nextStatus: updated.status,
    })

    return NextResponse.json({
      success: true,
      readyForGrant: true,
      applicationId,
      applicantAddress: lockedApp.address,
      application: updated,
      message: 'Approval initialized. Execute grantRole on-chain, then call /api/verifier/review/confirm.',
    })
  } catch (error) {
    console.error('Error in POST /api/verifier/review/init:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    if (applicationId && locked) {
      await unlockApplication(applicationId)
    }
  }
}
