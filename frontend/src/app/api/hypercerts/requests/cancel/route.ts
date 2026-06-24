import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildCancelMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import {
  deleteUnpublishedHypercertRequest,
  getHypercertRequestById,
} from '@/lib/supabase/hypercert-requests-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CancelBody = {
  requestId: string
  requester: string
  timestamp: number
  signature: `0x${string}`
}

/** Requester withdraws an unpublished Hypercert request. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CancelBody
    const requester = body.requester?.trim()
    const requestId = body.requestId?.trim()

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
    }
    if (!requester || !isAddress(requester)) {
      return NextResponse.json({ error: 'Invalid requester address' }, { status: 400 })
    }
    if (!body.signature || !body.timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const message = buildCancelMessage({
      requestId,
      requester: requester as Address,
      timestamp: body.timestamp,
    })

    const valid = await verifyMessage({
      address: requester as Address,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    const existing = await getHypercertRequestById(requestId)
    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    if (existing.requester.toLowerCase() !== requester.toLowerCase()) {
      return NextResponse.json({ error: 'Only the requester can cancel this request' }, { status: 403 })
    }
    if (existing.atUri) {
      return NextResponse.json({ error: 'Published Hypercerts cannot be cancelled' }, { status: 409 })
    }

    await deleteUnpublishedHypercertRequest({ id: requestId, requester })

    return NextResponse.json({ success: true, requestId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Hypercert cancel failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
