import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildReviewMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import { getHypercertRequestById, updateHypercertRequestStatus } from '@/lib/supabase/hypercert-requests-db'
import { isAdminOnChain } from '@/lib/verifier/admin-check'

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

    const isAdmin = await isAdminOnChain(reviewer)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only Submission contract admins can approve or reject Hypercert requests' },
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

    return NextResponse.json({ success: true, request: updated })
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
