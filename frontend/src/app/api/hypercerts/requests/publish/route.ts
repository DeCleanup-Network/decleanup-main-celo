import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildPublishMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import { getHypercertRequestById } from '@/lib/supabase/hypercert-requests-db'
import { isAtProtoEnabled, getAtProtoOrgDid } from '@/lib/blockchain/hypercerts/atproto'
import { publishHypercertToAtProto } from '@/lib/blockchain/hypercerts/atproto-publish'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PublishBody = {
  requestId: string
  requester: string
  timestamp: number
  signature: `0x${string}`
}

/**
 * Requester publishes an approved certificate to Hyperscan (AT Protocol).
 * Use when auto-publish after verifier approval did not complete.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAtProtoEnabled()) {
      return NextResponse.json({ error: 'ATProto publishing is disabled on this server' }, { status: 503 })
    }

    const body = (await request.json()) as PublishBody
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

    const message = buildPublishMessage({
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
      return NextResponse.json({ error: 'Only the requester can publish this Hypercert' }, { status: 403 })
    }
    if (existing.atUri) {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        atUri: existing.atUri,
        atCid: existing.atCid,
        request: existing,
      })
    }
    if (existing.status !== 'APPROVED' && existing.status !== 'MINTED') {
      return NextResponse.json(
        { error: `Request must be verifier-approved before publishing (status: ${existing.status})` },
        { status: 409 }
      )
    }

    const result = await publishHypercertToAtProto(requestId, getAtProtoOrgDid())
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const updated = await getHypercertRequestById(requestId)

    return NextResponse.json({
      success: true,
      atUri: result.atUri,
      atCid: result.atCid,
      request: updated,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Hypercert publish failed' },
      { status: 500 }
    )
  }
}
