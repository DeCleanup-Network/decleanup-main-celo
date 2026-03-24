import { Address } from 'viem'

/**
 * DCU Points System
 *
 * DCU points act as the multiplier for earning; $cDCU is claimed later (e.g. via ClaimVault or
 * Impact Product NFT claim) and the claim amount is calculated based on the user's multiplier.
 * Impact form and/or recyclables add 5 DCU points total per submission (same bucket onchain).
 *
 * DCU Points are stored ONCHAIN through the RewardDistributor contract's internal DCUToken contract.
 *
 * How it works:
 * 1. RewardDistributor contract uses a DCUToken contract internally to track points
 * 2. When rewards are distributed (level claim, streak, referral, impact form/recyclables),
 *    the RewardDistributor calls dcuToken.mintReward() which transfers tokens from
 *    the contract's rewards pool to the user
 * 3. User's DCU points balance = their balance in the DCUToken contract
 * 4. Points are stored with 18 decimals (like standard ERC-20 tokens)
 *
 * Storage Location:
 * - Onchain: DCUToken contract (accessed via RewardDistributor.dcuToken())
 * - This file provides fallback localStorage functions for development/testing
 */

const STORAGE_KEY_PREFIX = 'decleanup_points_'

/**
 * Get points balance for a user (fallback to localStorage for development)
 * 
 * NOTE: In production, points are read from onchain via lib/contracts.ts
 * This function is kept as a fallback for development/testing when contracts aren't deployed
 */
export async function getPointsBalance(userAddress: Address): Promise<number> {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`)
    return stored ? parseFloat(stored) : 0
  } catch (error) {
    console.error('Error getting points balance from localStorage:', error)
    return 0
  }
}

/**
 * Add points to user's balance
 * This should be called when:
 * - Cleanup is verified (base reward)
 * - Enhanced impact form is submitted (+5 points)
 * - Referral is verified (+3 points)
 */
export async function addPoints(
  userAddress: Address,
  amount: number,
  reason?: string
): Promise<number> {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const currentBalance = await getPointsBalance(userAddress)
    const newBalance = currentBalance + amount

    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`,
      newBalance.toString()
    )

    // Log points addition for debugging
    console.log(`Added ${amount} points to ${userAddress}. Reason: ${reason || 'unknown'}. New balance: ${newBalance}`)

    return newBalance
  } catch (error) {
    console.error('Error adding points:', error)
    return 0
  }
}

/**
 * Get staked points (for future staking feature)
 * Currently returns 0, but structure is ready for staking implementation
 */
export async function getStakedPoints(userAddress: Address): Promise<number> {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}staked_${userAddress.toLowerCase()}`)
    return stored ? parseFloat(stored) : 0
  } catch (error) {
    console.error('Error getting staked points:', error)
    return 0
  }
}

/**
 * DCU Points are the native reward system
 * They are stored onchain and represent user's earned rewards
 * No exchange rate needed - points are the primary unit
 */

/**
 * Points reward amounts (matching original DCU rewards)
 * DCU points act as the multiplier; $cDCU rewards are claimed later based on these.
 */
export const POINTS_REWARDS = {
  LEVEL_REWARD: 10, // 10 points per level
  STREAK_REWARD: 2, // 2 points per week streak
  IMPACT_FORM_REWARD: 5, // 5 points for impact form and/or recyclables (single bucket onchain)
  CLEANUP_REWARD: 10, // 10 points per verified cleanup (adjust as needed)
} as const

/**
 * Add points for verified cleanup
 */
export async function addCleanupReward(userAddress: Address): Promise<number> {
  return addPoints(userAddress, POINTS_REWARDS.CLEANUP_REWARD, 'verified_cleanup')
}

/**
 * Add points for enhanced impact form
 */
export async function addImpactFormReward(userAddress: Address): Promise<number> {
  return addPoints(userAddress, POINTS_REWARDS.IMPACT_FORM_REWARD, 'enhanced_impact_form')
}

/**
 * Add points for level claim
 */
export async function addLevelReward(userAddress: Address): Promise<number> {
  return addPoints(userAddress, POINTS_REWARDS.LEVEL_REWARD, 'level_claim')
}

/**
 * Add points for streak
 */
export async function addStreakReward(userAddress: Address): Promise<number> {
  return addPoints(userAddress, POINTS_REWARDS.STREAK_REWARD, 'streak')
}

/**
 * Get total points earned (for leaderboard calculations)
 * This is the same as balance for now, but can be extended to track historical earnings
 */
export async function getTotalPointsEarned(userAddress: Address): Promise<number> {
  // For now, return balance. In production, this could track historical earnings separately
  return getPointsBalance(userAddress)
}

