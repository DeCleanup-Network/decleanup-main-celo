/**
 * GET /api/cdcu/eligibility?recipient=0x...
 *
 * Returns eligibility and claimable $cDCU for the given address.
 * Eligibility: 50+ DCU points. Claimable = (points - 50) × 0.1 (minus already issued).
 */

import { NextResponse } from 'next/server'
import { type Address, isAddress } from 'viem'
import { getEligibilityAndClaimable, loadIssuedStore, getPendingAmount } from '@/lib/cdcu/claim-signing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient')?.trim()
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json(
        { error: 'Invalid or missing recipient' },
        { status: 400 }
      )
    }

    const { totalPointsWei, eligible, claimableCapWei } = await getEligibilityAndClaimable(recipient as Address)
    const store = loadIssuedStore()
    const alreadyClaimedWei = BigInt(store[recipient.toLowerCase()] ?? '0')
    const pendingWei = getPendingAmount(store, recipient)
    const claimableNowWei = claimableCapWei > alreadyClaimedWei + pendingWei ? claimableCapWei - alreadyClaimedWei - pendingWei : 0n

    return NextResponse.json({
      eligible,
      totalPoints: totalPointsWei.toString(),
      claimableCap: claimableCapWei.toString(),
      alreadyClaimed: alreadyClaimedWei.toString(),
      claimableNow: claimableNowWei.toString(),
      thresholdPoints: '50000000000000000000', // 50e18
    })
  } catch (e) {
    console.error('Eligibility check error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Eligibility check failed' },
      { status: 500 }
    )
  }
}
