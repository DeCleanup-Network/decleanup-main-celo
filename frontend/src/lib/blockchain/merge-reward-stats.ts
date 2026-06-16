import type { Address } from 'viem'
import { getUserRewardStats, getUserLevel, type UserRewardStats } from '@/lib/blockchain/contracts'

export function mergeUserRewardStats(a: UserRewardStats, b: UserRewardStats): UserRewardStats {
  return {
    currentBalance: a.currentBalance + b.currentBalance,
    totalEarned: a.totalEarned + b.totalEarned,
    totalClaimed: a.totalClaimed + b.totalClaimed,
    claimRewardsAmount: a.claimRewardsAmount + b.claimRewardsAmount,
    streakRewardsAmount: a.streakRewardsAmount + b.streakRewardsAmount,
    referralRewardsAmount: a.referralRewardsAmount + b.referralRewardsAmount,
    impactReportRewardsAmount: a.impactReportRewardsAmount + b.impactReportRewardsAmount,
    recyclablesRewardsAmount: a.recyclablesRewardsAmount + b.recyclablesRewardsAmount,
  }
}

/** EOA-first reward reads with optional legacy smart-account merge. */
export async function getMergedUserRewardStats(
  publicAddress: Address,
  onchainOwner?: Address | null
): Promise<UserRewardStats> {
  const primary = await getUserRewardStats(publicAddress)
  if (!onchainOwner || onchainOwner.toLowerCase() === publicAddress.toLowerCase()) {
    return primary
  }
  const linked = await getUserRewardStats(onchainOwner)
  return mergeUserRewardStats(primary, linked)
}

export async function getMergedUserLevel(
  publicAddress: Address,
  onchainOwner?: Address | null
): Promise<number> {
  const primary = await getUserLevel(publicAddress)
  if (!onchainOwner || onchainOwner.toLowerCase() === publicAddress.toLowerCase()) {
    return primary
  }
  const linked = await getUserLevel(onchainOwner)
  return Math.max(primary, linked)
}
