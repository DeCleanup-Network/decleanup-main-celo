import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildReviewMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import { getHypercertRequestById, updateHypercertRequestStatus } from '@/lib/supabase/hypercert-requests-db'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { isAtProtoEnabled, getAtProtoOrgDid } from '@/lib/blockchain/hypercerts/atproto'
import { publishHypercertToAtProto } from '@/lib/blockchain/hypercerts/atproto-publish'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes("Could not find the table") && msg.includes('hypercert_requests')
}

type ReviewBody = {
  requestId: string
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
    const requestId = body.requestId?.trim()

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
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

    const message = buildReviewMessage({
      action: body.action,
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
        { error: 'Only Submission contract verifiers or admins can approve or reject Hypercert requests' },
        { status: 403 }
      )
    }

    const existing = await getHypercertRequestById(requestId)
    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Request is not pending (status: ${existing.status})` },
        { status: 409 }
      )
    }

    const nextStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED'
    const updated = await updateHypercertRequestStatus({
      id: requestId,
      status: nextStatus,
      reviewedBy: reviewer,
      reviewedAt: Date.now(),
      rejectionReason: body.action === 'reject' ? body.reason : undefined,
    })

    // Publish to Hyperscan when verifier approves (server AT credentials).
    let publishWarning: string | undefined
    if (isAtProtoEnabled() && nextStatus === 'APPROVED') {
      const verifierDid = getAtProtoOrgDid()
      const result = await publishHypercertToAtProto(requestId, verifierDid)
      if (!result.success) {
        console.error(`[ATProto] Publish failed for ${requestId}: ${result.error}`)
        publishWarning = result.error ?? 'AT Protocol publish failed after approval.'
      } else {
        console.log(`[ATProto] Published ${requestId} -> ${result.atUri}`)
      }
    }

    const latest = await getHypercertRequestById(requestId)

    const wallet = latest?.requester || existing.requester
    if (wallet) {
      const { notifyWallet } = await import('@/lib/server/notifications/events')
      if (nextStatus === 'APPROVED') {
        await notifyWallet(wallet, {
          type: publishWarning ? 'hypercert_fail' : 'hypercert_success',
          title: publishWarning ? 'Hypercert approved (publish issue)' : 'Hypercert approved',
          body: publishWarning
            ? `Your Hypercert was approved but publishing had an issue: ${publishWarning}`
            : 'Your Hypercert request was approved and published.',
          href: '/hypercerts',
          meta: { requestId },
        })
      } else {
        await notifyWallet(wallet, {
          type: 'hypercert_fail',
          title: 'Hypercert declined',
          body: body.reason || 'Your Hypercert request was not approved.',
          href: '/hypercerts',
          meta: { requestId },
        })
      }
    }

    return NextResponse.json({
      success: true,
      request: latest ?? updated,
      publishWarning,
    })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: 'Database not ready: run hypercert_requests migration in Supabase.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Review failed' },
      { status: 500 }
    )
  }
}
