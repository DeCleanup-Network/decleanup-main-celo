import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  getSponsorEventById,
  isSponsorshipDbConfigured,
  updateSponsorEventStatus,
} from '@/lib/supabase/sponsorship-events'
import { assertFreshTimestamp, buildFundingReviewMessage } from '@/lib/sponsor/review-signing'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  eventId?: string
  action?: 'approve' | 'reject'
  reviewer?: string
  timestamp?: number
  signature?: `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }

    const body = (await request.json()) as Body
    const eventId = body.eventId?.trim()
    const reviewer = body.reviewer?.trim()

    const limited = await enforceApiRateLimit({
      request,
      scope: 'sponsor-events-review',
      maxRequests: 40,
      windowMs: 60_000,
      walletAddress: reviewer || null,
    })
    if (!limited.ok) return limited.response

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: 'Invalid reviewer address' }, { status: 400 })
    }
    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (!body.signature || body.timestamp == null) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const message = buildFundingReviewMessage({
      action: body.action,
      eventId,
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
      return NextResponse.json({ error: 'Only verifiers can review funding applications' }, { status: 403 })
    }

    const existing = await getSponsorEventById(eventId)
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Not pending (status: ${existing.status})` }, { status: 400 })
    }

    const event = await updateSponsorEventStatus(
      eventId,
      body.action === 'approve' ? 'active' : 'ended',
      reviewer
    )

    return NextResponse.json({ success: true, event })
  } catch (e) {
    logApiError('sponsor/events/review POST', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to review application') }, { status: 500 })
  }
}
