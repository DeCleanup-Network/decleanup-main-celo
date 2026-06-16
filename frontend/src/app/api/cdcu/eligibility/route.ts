/**
 * GET /api/cdcu/eligibility?recipient=0x...
 *
 * Each claim uses one 50-DCU tranche; the next claim needs 50 more DCU (next milestone).
 */

import { NextResponse } from 'next/server'
import { type Address, formatEther, isAddress } from 'viem'
import {
  getEligibilityAndClaimable,
  getIssuedWei,
  getPendingWei,
  getActivityMultiplierWei,
  ELIGIBILITY_THRESHOLD_WEI,
  DCU_POINTS_PER_TRANCHE,
} from '@/lib/cdcu/claim-signing'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

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

    const identity = await resolveWalletIdentity(recipient)
    const rewardIdentity = (identity?.publicAddress ?? recipient) as Address
    const linkedAccount =
      identity?.smartAccountAddress &&
      identity.smartAccountAddress.toLowerCase() !== rewardIdentity.toLowerCase()
        ? identity.smartAccountAddress
        : undefined

    const {
      totalPointsWei,
      eligible,
      claimableCapWei,
      milestonesClaimed,
      nextMilestonePointsWei,
      claimableNextTrancheWei,
    } = await getEligibilityAndClaimable(rewardIdentity, {
      mintRecipient: mintRecipient && isAddress(mintRecipient) ? (mintRecipient as Address) : undefined,
      linkedAccount,
    })
    const [issuedPrimary, issuedLinked, pendingPrimary, pendingLinked] = await Promise.all([
      getIssuedWei(rewardIdentity),
      linkedAccount ? getIssuedWei(linkedAccount) : Promise.resolve(0n),
      getPendingWei(rewardIdentity),
      linkedAccount ? getPendingWei(linkedAccount) : Promise.resolve(0n),
    ])
    const alreadyClaimedWei = issuedPrimary + issuedLinked
    const pendingWei = pendingPrimary + pendingLinked
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
