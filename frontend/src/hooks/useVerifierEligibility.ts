/**
 * Hook: Check verifier eligibility
 * Returns: eligible status, missing requirements, current metrics
 */

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { VerifierEligibility, VerifierMetrics } from '@/lib/verifier/types'
import {
  getUserLevelFresh,
  getUserSubmissionsFresh,
  getCleanupDetailsFresh,
  getUserRewardStats,
} from '@/lib/blockchain/contracts'
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
  const { submissionOwnerAddress } = useSmartAccountClient()
  /** Same identity as dashboard / submissions: Safe when gasless, else EOA (undefined while Safe resolves). */
  const rewardOwner = submissionOwnerAddress
  const [eligibility, setEligibility] = useState<VerifierEligibility | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEligibility = useCallback(async (silent = false) => {
    if (!rewardOwner) {
      setEligibility(null)
      return
    }

    if (!silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      // Fresh reads: eligibility must not use stale cached level/DCU after mints or claims.
      const level = await getUserLevelFresh(rewardOwner)
      const rewardStats = await getUserRewardStats(rewardOwner)
      const dcuPointsEarned = Number(rewardStats.totalEarned) / 1e18

      const submissions = await getUserSubmissionsFresh(rewardOwner)
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
  }, [rewardOwner])

  useEffect(() => {
    void fetchEligibility(false)
  }, [fetchEligibility])

  useEffect(() => {
    if (!rewardOwner) return
    const id = setInterval(() => {
      void fetchEligibility(true)
    }, ELIGIBILITY_POLL_MS)
    return () => clearInterval(id)
  }, [rewardOwner, fetchEligibility])

  useEffect(() => {
    if (!rewardOwner) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchEligibility(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [rewardOwner, fetchEligibility])

  return {
    eligibility,
    isLoading,
    error,
    refetch: () => fetchEligibility(false),
  }
}
