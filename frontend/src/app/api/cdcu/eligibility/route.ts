/**
 * GET /api/cdcu/eligibility?recipient=0x...
 *
 * Each claim uses one 50-DCU tranche; the next claim needs 50 more DCU (next milestone).
 */

import { NextResponse } from 'next/server'
import { type Address, formatEther, isAddress } from 'viem'
import {
  getEligibilityAndClaimable,
  loadIssuedStore,
  getPendingAmount,
  getActivityMultiplierWei,
  ELIGIBILITY_THRESHOLD_WEI,
  DCU_POINTS_PER_TRANCHE,
} from '@/lib/cdcu/claim-signing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient')?.trim()
    const mintRecipient = searchParams.get('mintRecipient')?.trim()
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json(
        { error: 'Invalid or missing recipient' },
        { status: 400 }
      )
    }
    if (mintRecipient && !isAddress(mintRecipient)) {
      return NextResponse.json({ error: 'Invalid mintRecipient' }, { status: 400 })
    }

    const {
      totalPointsWei,
      eligible,
      claimableCapWei,
      milestonesClaimed,
      nextMilestonePointsWei,
      claimableNextTrancheWei,
    } = await getEligibilityAndClaimable(recipient as Address, {
      mintRecipient: mintRecipient && isAddress(mintRecipient) ? (mintRecipient as Address) : undefined,
    })
    const store = loadIssuedStore()
    const alreadyClaimedWei = BigInt(store[recipient.toLowerCase()] ?? '0')
    const pendingWei = getPendingAmount(store, recipient)
    const claimableNowWei =
      claimableNextTrancheWei > pendingWei ? claimableNextTrancheWei - pendingWei : 0n

    const multWei = getActivityMultiplierWei(totalPointsWei)
    const activityMultiplier =
      totalPointsWei >= ELIGIBILITY_THRESHOLD_WEI && multWei > 0n ? formatEther(multWei) : null

    return NextResponse.json({
      eligible,
      totalPoints: totalPointsWei.toString(),
      claimableCap: claimableCapWei.toString(),
      claimableNextTranche: claimableNextTrancheWei.toString(),
      alreadyClaimed: alreadyClaimedWei.toString(),
      claimableNow: claimableNowWei.toString(),
      milestonesClaimed,
      nextMilestonePoints: nextMilestonePointsWei.toString(),
      thresholdPoints: '50000000000000000000', // 50e18 per tranche
      dcuPointsPerTranche: DCU_POINTS_PER_TRANCHE,
      activityMultiplier,
    })
  } catch (e) {
    console.error('Eligibility check error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Eligibility check failed' },
      { status: 500 }
    )
  }
}
