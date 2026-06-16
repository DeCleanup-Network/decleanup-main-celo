/**
 * Hook: Check verifier eligibility
 * Returns: eligible status, missing requirements, current metrics
 */

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { VerifierEligibility, VerifierMetrics } from '@/lib/verifier/types'
import {
  getUserSubmissionsFresh,
  getCleanupDetailsFresh,
} from '@/lib/blockchain/contracts'
import { getMergedUserRewardStats, getMergedUserLevel } from '@/lib/blockchain/merge-reward-stats'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { CONTRACT_READ_TTL_MS } from '@/lib/contractCache'
import { Address } from 'viem'

/** Re-fetch eligibility while the user stays on the page (level/DCU change without wallet reconnect). */
const ELIGIBILITY_POLL_MS = Math.max(CONTRACT_READ_TTL_MS, 45_000)

interface UseVerifierEligibilityResult {
  eligibility: VerifierEligibility | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useVerifierEligibility(): UseVerifierEligibilityResult {
  const { address } = useAccount()
  const { submissionOwnerAddress, publicWalletAddress, onchainOwnerAddress } = useSmartAccountClient()
  const rewardIdentity = (publicWalletAddress ?? address) as Address | undefined
  const submissionOwner = (onchainOwnerAddress ?? submissionOwnerAddress) as Address | undefined
  const [eligibility, setEligibility] = useState<VerifierEligibility | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEligibility = useCallback(async (silent = false) => {
    if (!rewardIdentity || !submissionOwner) {
      setEligibility(null)
      return
    }

    if (!silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const level = await getMergedUserLevel(rewardIdentity, submissionOwner)
      const rewardStats = await getMergedUserRewardStats(rewardIdentity, submissionOwner)
      const dcuPointsEarned = Number(rewardStats.totalEarned) / 1e18

      const submissions = await getUserSubmissionsFresh(submissionOwner)
      let approvedCount = 0

      for (const submissionId of submissions) {
        try {
          const details = await getCleanupDetailsFresh(submissionId)
          if (details.verified && !details.rejected) {
            approvedCount++
          }
        } catch (e) {
          console.warn(`Failed to fetch cleanup ${submissionId}:`, e)
        }
      }

      const metrics: VerifierMetrics = {
        level: Number(level),
        dcuBalance: dcuPointsEarned,
        approvedCleanups: approvedCount,
      }

      const result = checkEligibility(metrics)
      setEligibility(result)
    } catch (err) {
      console.error('Error fetching verifier eligibility:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch eligibility')
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [rewardIdentity, submissionOwner])

  useEffect(() => {
    void fetchEligibility(false)
  }, [fetchEligibility])

  useEffect(() => {
    if (!rewardIdentity || !submissionOwner) return
    const id = setInterval(() => {
      void fetchEligibility(true)
    }, ELIGIBILITY_POLL_MS)
    return () => clearInterval(id)
  }, [rewardIdentity, submissionOwner, fetchEligibility])

  useEffect(() => {
    if (!rewardIdentity || !submissionOwner) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchEligibility(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [rewardIdentity, submissionOwner, fetchEligibility])

  return {
    eligibility,
    isLoading,
    error,
    refetch: () => fetchEligibility(false),
  }
}
