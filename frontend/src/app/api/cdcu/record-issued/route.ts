/**
 * POST /api/cdcu/record-issued
 *
 * Called by the frontend after the user successfully submits the claim tx onchain.
 * Moves the pending amount to issued so the backend doesn't block the next claim.
 *
 * Body: { recipient: string, amount: string } (amount in wei)
 */

import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { recordIssued } from '@/lib/cdcu/claim-signing'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = body?.recipient?.trim()
    const amount = body?.amount
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }
    const amountWei = BigInt(amount ?? '0')
    if (amountWei <= 0n) {
      return NextResponse.json({ error: 'Invalid or missing amount' }, { status: 400 })
    }
    await recordIssued(recipient, amountWei)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('record-issued error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to record issued' },
      { status: 500 }
    )
  }
}
