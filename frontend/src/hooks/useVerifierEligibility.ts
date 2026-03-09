/**
 * Hook: Check verifier eligibility
 * Returns: eligible status, missing requirements, current metrics
 */

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { VerifierEligibility, VerifierMetrics } from '@/lib/verifier/types'
import { getUserLevel, getDCUBalance, getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { Address } from 'viem'

interface UseVerifierEligibilityResult {
  eligibility: VerifierEligibility | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useVerifierEligibility(): UseVerifierEligibilityResult {
  const { address } = useAccount()
  const [eligibility, setEligibility] = useState<VerifierEligibility | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEligibility = async () => {
    if (!address) {
      setEligibility(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch level
      const level = await getUserLevel(address)

      // Fetch DCU balance
      const dcuBalance = await getDCUBalance(address)
      const dcuBalanceNumber = Number(dcuBalance) / 1e18 // Convert from wei

      // Fetch approved cleanups count
      const submissions = await getUserSubmissions(address)
      let approvedCount = 0

      for (const submissionId of submissions) {
        try {
          const details = await getCleanupDetails(submissionId)
          // verified=true and rejected=false means approved
          if (details.verified && !details.rejected) {
            approvedCount++
          }
        } catch (e) {
          console.warn(`Failed to fetch cleanup ${submissionId}:`, e)
        }
      }

      // Check eligibility
      const metrics: VerifierMetrics = {
        level: Number(level),
        dcuBalance: dcuBalanceNumber,
        approvedCleanups: approvedCount,
      }

      const result = checkEligibility(metrics)
      setEligibility(result)
    } catch (err) {
      console.error('Error fetching verifier eligibility:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch eligibility')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEligibility()
  }, [address])

  return {
    eligibility,
    isLoading,
    error,
    refetch: fetchEligibility,
  }
}
