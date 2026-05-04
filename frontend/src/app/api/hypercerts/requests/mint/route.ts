import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import {
  assertFreshTimestamp,
  buildMintRecordMessage,
} from '@/lib/blockchain/hypercerts/request-signing'
import { getHypercertRequestById, recordHypercertMint } from '@/lib/supabase/hypercert-requests-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes("Could not find the table") && msg.includes('hypercert_requests')
}

type MintBody = {
  requestId: string
  requester: string
  hypercertId: string
  txHash: string
  metadataCid: string
  timestamp: number
  signature: `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MintBody
    const requester = body.requester?.trim()
    const requestId = body.requestId?.trim()

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
    }
    if (!requester || !isAddress(requester)) {
      return NextResponse.json({ error: 'Invalid requester' }, { status: 400 })
    }
    if (!body.hypercertId || !body.txHash || !body.metadataCid) {
      return NextResponse.json({ error: 'Missing mint fields' }, { status: 400 })
    }
    if (!body.signature || !body.timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const message = buildMintRecordMessage({
      requestId,
      requester: requester as Address,
      hypercertId: body.hypercertId,
      txHash: body.txHash,
      metadataCid: body.metadataCid,
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
      return NextResponse.json({ error: 'Requester mismatch' }, { status: 403 })
    }
    if (existing.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Mint only allowed after approval (current: ${existing.status})` },
        { status: 409 }
      )
    }

    const updated = await recordHypercertMint({
      id: requestId,
      hypercertId: body.hypercertId,
      txHash: body.txHash,
      metadataCid: body.metadataCid,
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
      { error: e instanceof Error ? e.message : 'Mint record failed' },
      { status: 500 }
    )
  }
}
