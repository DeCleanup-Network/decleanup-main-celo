/**
 * POST /api/verifier/apply
 * 
 * User applies to become verifier
 * 
 * Flow:
 * 1. Validate wallet signature
 * 2. Check eligibility
 * 3. Check if already has pending/approved
 * 4. Create application
 * 5. Return result
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { 
  createApplication, 
  hasPendingApplication, 
  hasApprovedApplication 
} from '@/lib/verifier/applications'
import { VerifierMetrics } from '@/lib/verifier/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, metrics } = body

    // Validate address
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      )
    }

    // Validate metrics
    if (!metrics || typeof metrics.level !== 'number' || typeof metrics.dcuBalance !== 'number' || typeof metrics.approvedCleanups !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metrics provided' },
        { status: 400 }
      )
    }

    // Check if already has pending application
    if (hasPendingApplication(address)) {
      return NextResponse.json(
        { error: 'You already have a pending application' },
        { status: 409 }
      )
    }

    // Check if already approved
    if (hasApprovedApplication(address)) {
      return NextResponse.json(
        { error: 'You are already an approved verifier' },
        { status: 409 }
      )
    }

    // Check eligibility
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

    // Create application
    const application = createApplication(address)

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
