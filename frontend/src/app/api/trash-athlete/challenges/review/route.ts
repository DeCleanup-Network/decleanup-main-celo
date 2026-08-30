import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildTrashAthleteReviewMessage,
} from '@/lib/trash-athlete/review-signing'
import { getTrashAthleteById, updateTrashAthleteReview } from '@/lib/supabase/trash-athlete-db'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReviewBody = {
  challengeId: string
  action: 'approve' | 'reject'
  reviewer: string
  timestamp: number
  signature: `0x${string}`
  reason?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReviewBody
    const reviewer = body.reviewer?.trim()
    const challengeId = body.challengeId?.trim()

    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: 'Invalid reviewer address' }, { status: 400 })
    }
    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (!body.signature || !body.timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const message = buildTrashAthleteReviewMessage({
      action: body.action,
      challengeId,
      reviewer: reviewer as Address,
      timestamp: body.timestamp,
    })

    const valid = await verifyMessage({
      address: reviewer as Address,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    const canReview = await canReviewHypercertOnChain(reviewer)
    if (!canReview) {
      return NextResponse.json(
        { error: 'Only verifiers or admins can review Trash Athlete Challenges' },
        { status: 403 }
      )
    }

    const existing = await getTrashAthleteById(challengeId)
    if (!existing) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Challenge is not pending (status: ${existing.status})` },
        { status: 400 }
      )
    }

    const updated = await updateTrashAthleteReview({
      id: challengeId,
      status: body.action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedBy: reviewer,
      rejectionReason: body.reason,
    })

    return NextResponse.json({
      success: true,
      challenge: updated,
      rewardsNote:
        body.action === 'approve'
          ? 'Approved. User can claim 150 $cDCU. Level 3 + 30 DCU still need ops grant (contracts cannot jump levels in one tx).'
          : undefined,
    })
  } catch (e) {
    logApiError('trash-athlete/review', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Review failed') }, { status: 500 })
  }
}
