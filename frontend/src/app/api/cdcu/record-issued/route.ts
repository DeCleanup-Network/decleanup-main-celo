/**
 * POST /api/cdcu/record-issued
 *
 * Called by the frontend after the user successfully submits the claim tx onchain.
 * Moves the pending amount to issued so the backend doesn't block the next claim.
 *
 * Body: { recipient: string, amount: string, txHash: string } (amount in wei)
 * - recipient: reward identity (same value sent as `source` to claim-request)
 * - txHash: the ClaimVault claim tx; it must contain a CleanupCampaign `Claimed` event for
 *   `amount` paid to the reward identity or its canonical Safe, and is recorded only once.
 */

import { NextResponse } from 'next/server'
import { isAddress, isHash } from 'viem'
import { getCleanupCampaignClaimsInTx, recordIssued } from '@/lib/cdcu/claim-signing'
import { markClaimTxRecorded } from '@/lib/cdcu/issued-store'
import { isAllowedRecipient, resolveClaimIdentity } from '@/lib/cdcu/claim-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = body?.recipient?.trim()
    const amount = body?.amount
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }
    let amountWei: bigint
    try {
      amountWei = BigInt(amount ?? '0')
    } catch {
      return NextResponse.json({ error: 'Invalid or missing amount' }, { status: 400 })
    }
    if (amountWei <= 0n) {
      return NextResponse.json({ error: 'Invalid or missing amount' }, { status: 400 })
    }
    if (!isHash(txHash)) {
      return NextResponse.json({ error: 'Invalid or missing txHash' }, { status: 400 })
    }

    const identity = await resolveClaimIdentity(recipient)
    const claims = await getCleanupCampaignClaimsInTx(txHash)
    const matches = claims.some(
      (c) => c.amount === amountWei && isAllowedRecipient(identity, c.recipient)
    )
    if (!matches) {
      return NextResponse.json(
        { error: 'Transaction does not contain a matching $cDCU claim' },
        { status: 400 }
      )
    }

    if (!(await markClaimTxRecorded(txHash))) {
      return NextResponse.json({ ok: true, alreadyRecorded: true })
    }
    await recordIssued(identity.rewardIdentity, amountWei)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('record-issued error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to record issued' },
      { status: 500 }
    )
  }
}
