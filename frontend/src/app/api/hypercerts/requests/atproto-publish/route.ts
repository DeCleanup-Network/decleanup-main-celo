import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildRepublishMessage,
  buildReviewMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import { getHypercertRequestById } from '@/lib/supabase/hypercert-requests-db'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { isAtProtoEnabled, getAtProtoOrgDid } from '@/lib/blockchain/hypercerts/atproto'
import { publishHypercertToAtProto } from '@/lib/blockchain/hypercerts/atproto-publish'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RepublishBody = {
  requestId: string
  reviewer: string
  timestamp: number
  signature: `0x${string}`
  /** When true, creates a new AT activity (e.g. smallImage cover) even if at_uri exists. */
  force?: boolean
}

/**
 * Re-publishes an approved or minted hypercert to ATProto.
 * - Default: only when initial publish failed (at_uri null).
 * - force=true: verifier creates a new activity record (cover fix, schema updates).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAtProtoEnabled()) {
      return NextResponse.json({ error: 'ATProto publishing is disabled' }, { status: 503 })
    }

    const body = (await request.json()) as RepublishBody
    const reviewer = body.reviewer?.trim()
    const requestId = body.requestId?.trim()
    const force = body.force === true

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: 'Invalid reviewer address' }, { status: 400 })
    }
    if (!body.signature || !body.timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const message = force
      ? buildRepublishMessage({
          requestId,
          reviewer: reviewer as Address,
          timestamp: body.timestamp,
        })
      : buildReviewMessage({
          action: 'approve',
          requestId,
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
        { error: 'Only Submission contract verifiers or admins can republish Hypercerts' },
        { status: 403 }
      )
    }

    const existing = await getHypercertRequestById(requestId)
    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (!force && existing.atUri) {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        atUri: existing.atUri,
        atCid: existing.atCid,
      })
    }
    if (existing.status !== 'APPROVED' && existing.status !== 'MINTED') {
      return NextResponse.json(
        { error: `Request must be approved (status: ${existing.status})` },
        { status: 409 }
      )
    }

    const previousUri = existing.atUri
    const result = await publishHypercertToAtProto(requestId, getAtProtoOrgDid(), { force })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      republished: force && Boolean(previousUri),
      previousAtUri: previousUri ?? null,
      atUri: result.atUri,
      atCid: result.atCid,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ATProto republish failed' },
      { status: 500 }
    )
  }
}
