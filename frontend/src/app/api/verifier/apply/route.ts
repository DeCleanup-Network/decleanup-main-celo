/**
 * POST /api/verifier/apply
 * 
 * User applies to become verifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { createApplication, hasPendingApplication, hasApprovedApplication } from '@/lib/supabase/applications'
import { VerifierMetrics } from '@/lib/verifier/types'
import { validateInput, VerifierApplySchema } from '@/lib/validation/verifier-schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // STEP 1: Validate input with Zod
    const validation = validateInput(VerifierApplySchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.errors.flatten(),
        },
        { status: 400 }
      )
    }

    const { address, metrics } = validation.data

    // STEP 2: Check if already has pending application
    const hasPending = await hasPendingApplication(address)
    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending application' },
        { status: 409 }
      )
    }

    // STEP 3: Check if already approved
    const hasApproved = await hasApprovedApplication(address)
    if (hasApproved) {
      return NextResponse.json(
        { error: 'You are already an approved verifier' },
        { status: 409 }
      )
    }

    // STEP 4: Check eligibility
    const eligibility = checkEligibility(metrics as VerifierMetrics)
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: 'Not eligible to apply',
          reasons: eligibility.reasons,
        },
        { status: 403 }
      )
    }

    // STEP 5: Create application in Supabase
    const application = await createApplication(address)

    console.log(`✅ Verifier application created: ${application.id} for ${address}`)

    return NextResponse.json(
      {
        success: true,
        application,
        message: 'Application submitted successfully. Admins will review your application.',
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error in POST /api/verifier/apply:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
