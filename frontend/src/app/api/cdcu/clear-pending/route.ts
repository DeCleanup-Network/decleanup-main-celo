/**
 * POST /api/cdcu/clear-pending
 *
 * Clears the pending claim for the given recipient so they can request a new signature
 * (e.g. after cancelling the wallet tx or if the signature expired).
 *
 * Body: { recipient: string }
 */

import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { clearPending } from '@/lib/cdcu/claim-signing'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = body?.recipient?.trim()
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }
    clearPending(recipient)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('clear-pending error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to clear pending' },
      { status: 500 }
    )
  }
}
