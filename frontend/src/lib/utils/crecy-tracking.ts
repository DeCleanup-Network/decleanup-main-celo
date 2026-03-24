import { Address } from 'viem'

/**
 * Local cRECY Token Tracking (Deprecated)
 *
 * Recyclables are now rewarded with DCU points (same as impact form) via lib/utils/points.ts
 * and onchain via rewardImpactReports. This module is no longer used in the app; kept for
 * reference or optional re-enable of a separate recyclables token.
 *
 * Reward amount was: 5 cRECY per approved recyclables submission.
 */

const STORAGE_KEY_PREFIX = 'decleanup_crecy_'
const REWARD_AMOUNT = 5 // 5 cRECY per submission

/**
 * Get cRECY balance for a user (local storage for testing)
 */
export function getCrecyBalance(userAddress: Address): number {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`)
    return stored ? parseFloat(stored) : 0
  } catch (error) {
    console.error('Error getting cRECY balance from localStorage:', error)
    return 0
  }
}

/**
 * Add cRECY reward for a recyclables submission (testing only)
 * This simulates the reward that would be given on mainnet
 */
export function addCrecyReward(userAddress: Address, submissionId: bigint): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const currentBalance = getCrecyBalance(userAddress)
    const newBalance = currentBalance + REWARD_AMOUNT
    
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`,
      newBalance.toString()
    )

    // Track which submissions have been rewarded (to prevent duplicates)
    const rewardedKey = `${STORAGE_KEY_PREFIX}rewarded_${userAddress.toLowerCase()}`
    const rewarded = JSON.parse(localStorage.getItem(rewardedKey) || '[]')
    if (!rewarded.includes(submissionId.toString())) {
      rewarded.push(submissionId.toString())
      localStorage.setItem(rewardedKey, JSON.stringify(rewarded))
    }

    console.log(`✅ Added ${REWARD_AMOUNT} cRECY reward for submission ${submissionId.toString()}`)
    console.log(`   New balance: ${newBalance} cRECY`)
  } catch (error) {
    console.error('Error adding cRECY reward:', error)
  }
}

/**
 * Check if a submission has already been rewarded (prevent duplicates)
 */
export function isSubmissionRewarded(userAddress: Address, submissionId: bigint): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const rewardedKey = `${STORAGE_KEY_PREFIX}rewarded_${userAddress.toLowerCase()}`
    const rewarded = JSON.parse(localStorage.getItem(rewardedKey) || '[]')
    return rewarded.includes(submissionId.toString())
  } catch (error) {
    console.error('Error checking if submission is rewarded:', error)
    return false
  }
}

/**
 * Get reward amount per submission
 */
export function getRewardAmount(): number {
  return REWARD_AMOUNT
}

/**
 * Clear all cRECY data for a user (for testing/reset)
 */
export function clearCrecyData(userAddress: Address): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`)
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}rewarded_${userAddress.toLowerCase()}`)
  } catch (error) {
    console.error('Error clearing cRECY data:', error)
  }
}

