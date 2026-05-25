'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { formatEther } from 'viem'
import {
  getUserRewardStats,
  getUserLevel,
  getUserTokenId,
  getClaimFee,
  getUserSubmissions,
  getCleanupDetails,
  getVerifierRewardsCount,
} from '@/lib/blockchain/contracts'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { getContributorMentionStats } from '@/lib/impact/contributor-stats'
import { loadImpactProductDisplay, type ImpactProductDisplayState } from '@/lib/dashboard/load-impact-product-display'
import { scheduleIdle } from '@/lib/dashboard/schedule-idle'

export type HomeCleanupStatus = {
  hasPendingCleanup: boolean
  canClaim: boolean
  cleanupId?: bigint
  level?: number
}

export type HomeRewardStats = {
  totalEarnedDCU: number
  cleanupsDCU: number
  verifiedCleanupsCount: number
  cleanupsCount: number
  referralsDCU: number
  streakDCU: number
  reportsDCU: number
  recyclablesDCU: number
  impactReportsCount: number
  recyclablesTaggedCount: number
  hypercertsDCU: number
  verifierDCU: number
  userLevel: number
  contributorCleanupCount: number
  impactReportsAttributed: number
}

const EMPTY_REWARD_STATS: HomeRewardStats = {
  totalEarnedDCU: 0,
  cleanupsDCU: 0,
  verifiedCleanupsCount: 0,
  cleanupsCount: 0,
  referralsDCU: 0,
  streakDCU: 0,
  reportsDCU: 0,
  recyclablesDCU: 0,
  impactReportsCount: 0,
  recyclablesTaggedCount: 0,
  hypercertsDCU: 0,
  verifierDCU: 0,
  userLevel: 0,
  contributorCleanupCount: 0,
  impactReportsAttributed: 0,
}

const EMPTY_IMPACT_PRODUCT: ImpactProductDisplayState = {
  level: 0,
  imageUrl: '',
  animationUrl: '',
  tokenId: null,
  metadataName: null,
  metadataDescription: null,
  metadataExternalUrl: null,
  metadataAttributes: [],
}

function rewardStatsFromContract(
  rewardStatsData: Awaited<ReturnType<typeof getUserRewardStats>>,
  level: number,
  extras: Partial<HomeRewardStats> = {}
): HomeRewardStats {
  const totalEarnedDCU = Number(formatEther(rewardStatsData.totalEarned))
  const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
  const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
  const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
  const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
  const recyclablesDCU = Number(formatEther(rewardStatsData.recyclablesRewardsAmount))

  return {
    totalEarnedDCU,
    cleanupsDCU,
    cleanupsCount: Math.floor(cleanupsDCU / 10),
    referralsDCU,
    streakDCU,
    reportsDCU,
    recyclablesDCU,
    impactReportsCount: Math.floor(reportsDCU / 5),
    recyclablesTaggedCount: Math.floor(recyclablesDCU / 5),
    userLevel: level,
    verifiedCleanupsCount: extras.verifiedCleanupsCount ?? 0,
    hypercertsDCU: extras.hypercertsDCU ?? 0,
    verifierDCU: extras.verifierDCU ?? 0,
    contributorCleanupCount: extras.contributorCleanupCount ?? 0,
    impactReportsAttributed: extras.impactReportsAttributed ?? 0,
  }
}

type Params = {
  mounted: boolean
  isConnected: boolean
  address?: Address
  submissionOwnerAddress?: Address
  chainId?: number
  /** When true, load per-submission details for breakdown / verified counts. */
  wantSubmissionDetails: boolean
}

/**
 * Home dashboard on-chain data with phased loading:
 * - Phase 1 (immediate): status, rewards summary, level, claim fee — hero + REWARDS card
 * - Phase 2 (idle or breakdown open): submission details, verifier DCU, contributor stats, hypercert
 * - Phase 3 (async): Impact Product IPFS metadata
 */
export function useHomeDashboardOnChain({
  mounted,
  isConnected,
  address,
  submissionOwnerAddress,
  chainId,
  wantSubmissionDetails,
}: Params) {
  const [cleanupStatus, setCleanupStatus] = useState<HomeCleanupStatus | null>(null)
  const [hypercertEligibility, setHypercertEligibility] = useState<{
    cleanupCount: number
    hypercertCount: number
    isEligible: boolean
    testingOverride?: boolean
  } | null>(null)
  const [rewardStats, setRewardStats] = useState<HomeRewardStats>(EMPTY_REWARD_STATS)
  const [impactProduct, setImpactProduct] = useState<ImpactProductDisplayState>(EMPTY_IMPACT_PRODUCT)
  const [claimFeeInfo, setClaimFeeInfo] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  const [hasLoadedCoreOnce, setHasLoadedCoreOnce] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const cancelledRef = useRef(false)
  const detailsLoadedRef = useRef(false)
  const idleCancelRef = useRef<(() => void) | null>(null)

  const loadImpactProduct = useCallback(
    (level: number, tokenId: bigint | null, cancelled: { current: boolean }) => {
      if (level <= 0) {
        setImpactProduct(EMPTY_IMPACT_PRODUCT)
        return
      }
      void loadImpactProductDisplay(level, tokenId)
        .then((display) => {
          if (!cancelled.current) setImpactProduct(display)
        })
        .catch((err) => {
          console.error('Error loading Impact Product metadata:', err)
          if (!cancelled.current) {
            setImpactProduct({ ...EMPTY_IMPACT_PRODUCT, level, tokenId })
          }
        })
    },
    []
  )

  const loadSubmissionDetails = useCallback(
    async (owner: Address, level: number, rewardStatsData: Awaited<ReturnType<typeof getUserRewardStats>>) => {
      setDetailsLoading(true)
      try {
        const submissions = await getUserSubmissions(owner)
        const detailsList = await Promise.all(
          submissions.map((id) => getCleanupDetails(id).catch(() => null))
        )

        let verifiedCleanupsCount = 0
        let impactReportsCount = 0
        for (const details of detailsList) {
          if (details?.verified) {
            verifiedCleanupsCount++
            if (details.hasImpactForm) impactReportsCount++
          }
        }

        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanupsCount,
          reportsCount: impactReportsCount,
          chainId,
        })

        const [verifierCount, contribStats] = await Promise.all([
          getVerifierRewardsCount(owner),
          getContributorMentionStats(owner),
        ])

        if (cancelledRef.current) return

        setHypercertEligibility({
          isEligible: eligibilityResult.eligible,
          cleanupCount: eligibilityResult.cleanupsCount,
          hypercertCount: 0,
          testingOverride: eligibilityResult.testingOverride,
        })

        setRewardStats(
          rewardStatsFromContract(rewardStatsData, level, {
            verifiedCleanupsCount,
            hypercertsDCU: 0,
            verifierDCU: verifierCount,
            contributorCleanupCount: contribStats.contributorCleanupCount,
            impactReportsAttributed: contribStats.impactReportsAttributed,
          })
        )
        detailsLoadedRef.current = true
      } finally {
        if (!cancelledRef.current) setDetailsLoading(false)
      }
    },
    [chainId]
  )

  const loadCore = useCallback(async () => {
    if (!submissionOwnerAddress) return
    const owner = submissionOwnerAddress
    const cancelled = { current: false }

    try {
      const [status, rewardStatsData, level, tokenId, feeInfo] = await Promise.all([
        getUserCleanupStatus(owner),
        getUserRewardStats(owner),
        getUserLevel(owner),
        getUserTokenId(owner),
        getClaimFee(),
      ])

      if (cancelledRef.current) return

      setClaimFeeInfo(feeInfo)
      setCleanupStatus(status ?? null)
      setRewardStats(rewardStatsFromContract(rewardStatsData, level))
      setHasLoadedCoreOnce(true)
      loadImpactProduct(level, tokenId, cancelled)

      return { owner, level, rewardStatsData }
    } catch (error) {
      console.error('Error loading dashboard core:', error)
      return null
    }
  }, [submissionOwnerAddress, loadImpactProduct])

  const refreshFull = useCallback(async () => {
    detailsLoadedRef.current = false
    const core = await loadCore()
    if (!core) return
    await loadSubmissionDetails(core.owner, core.level, core.rewardStatsData)
    if (core.level > 0) {
      try {
        const tokenId = await getUserTokenId(core.owner)
        const display = await loadImpactProductDisplay(core.level, tokenId)
        if (!cancelledRef.current) setImpactProduct(display)
      } catch (error) {
        console.warn('[Home] Could not fetch Impact Product metadata after claim:', error)
      }
    }
  }, [loadCore, loadSubmissionDetails])

  // Core load + poll
  useEffect(() => {
    cancelledRef.current = false
    detailsLoadedRef.current = false

    if (!mounted || !isConnected || !address || !submissionOwnerAddress) {
      setCleanupStatus(null)
      setHypercertEligibility(null)
      setRewardStats(EMPTY_REWARD_STATS)
      setImpactProduct(EMPTY_IMPACT_PRODUCT)
      setClaimFeeInfo(null)
      setHasLoadedCoreOnce(false)
      return () => {
        cancelledRef.current = true
      }
    }

    setHasLoadedCoreOnce(false)

    void loadCore()

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void loadCore()
    }, 15000)

    return () => {
      cancelledRef.current = true
      clearInterval(interval)
      idleCancelRef.current?.()
    }
  }, [mounted, isConnected, address, submissionOwnerAddress, loadCore])

  // Defer heavy submission details until idle or breakdown opened
  useEffect(() => {
    if (!mounted || !isConnected || !submissionOwnerAddress || !hasLoadedCoreOnce) return
    if (!wantSubmissionDetails && detailsLoadedRef.current) return

    const runDetails = async () => {
      if (detailsLoadedRef.current && !wantSubmissionDetails) return
      try {
        const [rewardStatsData, level] = await Promise.all([
          getUserRewardStats(submissionOwnerAddress),
          getUserLevel(submissionOwnerAddress),
        ])
        if (cancelledRef.current) return
        await loadSubmissionDetails(submissionOwnerAddress, level, rewardStatsData)
      } catch (error) {
        console.error('Error loading dashboard details:', error)
      }
    }

    if (wantSubmissionDetails) {
      idleCancelRef.current?.()
      void runDetails()
      return
    }

    idleCancelRef.current?.()
    idleCancelRef.current = scheduleIdle(() => {
      void runDetails()
    })

    return () => idleCancelRef.current?.()
  }, [
    mounted,
    isConnected,
    submissionOwnerAddress,
    hasLoadedCoreOnce,
    wantSubmissionDetails,
    loadSubmissionDetails,
  ])

  return {
    cleanupStatus,
    hypercertEligibility,
    rewardStats,
    impactProduct,
    claimFeeInfo,
    hasLoadedDashboardOnce: hasLoadedCoreOnce,
    detailsLoading,
    refreshDashboard: refreshFull,
  }
}
