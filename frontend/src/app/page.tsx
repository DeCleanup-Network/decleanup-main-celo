'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAccount } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import { Leaf, Award, Users, Heart, Info, Trophy, CheckSquare, Loader2, X, TrendingUp } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import {
  claimImpactProductFromVerification,
  getHypercertEligibility,
  getDCUBalance,
  getUserRewardStats,
  getUserLevel,
  getUserTokenId,
  getTokenURI,
  getTokenURIForLevel,
  getUserSubmissions,
  getCleanupDetails,
  getClaimFee,
  getVerifierRewardsCount,
  type GaslessClient,
} from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/chain-constants'
import { getContributorMentionStats } from '@/lib/impact/contributor-stats'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { VerifierApplyCard } from '@/components/dashboard/VerifierApplyCard'
import { useIsVerifier } from '@/hooks/useIsVerifier'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { DashboardClaimCdcu } from '@/components/dashboard/DashboardClaimCdcu'
import { AlertModal } from '@/components/ui/alert-modal'
import { markCleanupAsClaimed, clearPendingCleanup } from '@/lib/blockchain/verification'
import { resetCleanupState, resetAllCleanupState } from '@/lib/utils/reset-cleanup'
import { generateReferralLink } from '@/lib/utils/sharing'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { fetchViaIpfsGatewayProxy } from '@/lib/utils/ipfs-gateway-proxy'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import type { Address } from 'viem'

interface ImpactAttribute {
  trait_type?: string
  value?: string | number
}

interface ImpactMetadata {
  name?: string
  description?: string
  external_url?: string
  image?: string
  animation_url?: string
  attributes?: ImpactAttribute[]
}

function extractImpactStats(metadata: ImpactMetadata | null) {
  let impactValue: string | null = null
  let dcuReward: string | null = null

  metadata?.attributes?.forEach((attr) => {
    const trait = attr?.trait_type?.toLowerCase()
    if (!trait) return
    if (trait === 'impact value') {
      impactValue = attr.value != null ? String(attr.value) : null
    } else if (trait === '$dcu' || trait === 'dcu' || trait.includes('dcu')) {
      dcuReward = attr.value != null ? String(attr.value) : null
    }
  })

  return { impactValue, dcuReward }
}

function convertIPFSToGateway(ipfsUrl: string): string {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl
  }
  let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
  if (path.startsWith('/')) path = path.substring(1)

  const defaultGateways = [
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ]
  return `${defaultGateways[0]}${path}`
}

async function fetchWithFallback(ipfsUrl: string): Promise<Response> {
  const jsonHeaders = { Accept: 'application/json' }

  if (!ipfsUrl.startsWith('ipfs://')) {
    return fetchViaIpfsGatewayProxy(ipfsUrl, {
      method: 'GET',
      headers: jsonHeaders,
      redirect: 'follow',
    })
  }

  const gateways = [
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ]

  let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
  if (path.startsWith('/')) path = path.substring(1)

  for (const gateway of gateways) {
    try {
      const url = `${gateway}${path}`
      const response = await fetchViaIpfsGatewayProxy(url, {
        method: 'GET',
        headers: jsonHeaders,
        redirect: 'follow',
      })
      if (response.ok) {
        return response
      }
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error)
    }
  }

  throw new Error(`All IPFS gateways failed for: ${ipfsUrl}`)
}

/** Avoid `response.json()` when the gateway returns an HTML error page (causes Unexpected token '<'). */
async function parseMetadataJsonFromResponse(res: Response): Promise<ImpactMetadata> {
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.startsWith('<')) {
    throw new Error('Metadata URL returned HTML instead of JSON')
  }
  return JSON.parse(text) as ImpactMetadata
}

type ImpactProductDisplayState = {
  level: number
  imageUrl: string
  animationUrl: string
  tokenId: bigint | null
  impactValue: string | null
  dcuReward: string | null
}

/** Load Impact Product image/metadata; prefers tokenId-based URI when minted. */
async function loadImpactProductDisplay(level: number, tokenId: bigint | null): Promise<ImpactProductDisplayState> {
  if (level <= 0) {
    return { level: 0, imageUrl: '', animationUrl: '', tokenId: null, impactValue: null, dcuReward: null }
  }

  try {
    let tokenURI = ''
    if (tokenId !== null) {
      tokenURI = await getTokenURI(tokenId)
    }
    if (!tokenURI) {
      tokenURI = await getTokenURIForLevel(level)
    }

    let imageUrl = ''
    let animationUrl = ''
    let impactValue: string | null = null
    let dcuReward: string | null = null

    if (tokenURI) {
      try {
        const metadataResponse = await fetchWithFallback(tokenURI)
        if (metadataResponse.ok) {
          const metadata = await parseMetadataJsonFromResponse(metadataResponse)

          const stats = extractImpactStats(metadata)
          impactValue = stats.impactValue
          dcuReward = stats.dcuReward

          if (metadata?.image) {
            let fixedImagePath = metadata.image
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            if (fixedImagePath.includes('/images/level')) {
              const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
              if (levelMatch) {
                const levelNum = levelMatch[1]
                fixedImagePath =
                  levelNum === '10'
                    ? `ipfs://${imagesCID}/IP10Placeholder.png`
                    : `ipfs://${imagesCID}/IP${levelNum}.png`
              }
            }
            imageUrl = convertIPFSToGateway(fixedImagePath)
          }

          if (metadata?.animation_url) {
            let fixedAnimationPath = metadata.animation_url
            if (fixedAnimationPath.includes('/video/level10')) {
              fixedAnimationPath = `ipfs://${process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'}/IP10VIdeo.mp4`
            }
            animationUrl = convertIPFSToGateway(fixedAnimationPath)
          }
        }
      } catch (metadataError) {
        console.error('Error fetching Impact Product metadata:', metadataError)
      }
    }

    const finalImageUrl =
      imageUrl ||
      (level > 0
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
            const imageName = level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`
            return `${gateway}${imagesCID}/${imageName}`
          })()
        : '')

    const finalAnimationUrl =
      animationUrl ||
      (level === 10
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
            return `${gateway}${imagesCID}/IP10VIdeo.mp4`
          })()
        : '')

    return {
      level,
      imageUrl: finalImageUrl,
      animationUrl: finalAnimationUrl,
      tokenId,
      impactValue,
      dcuReward,
    }
  } catch (error) {
    console.error('Error fetching Impact Product data:', error)
    const fallbackImageUrl =
      level > 0
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
            const imageName = level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`
            return `${gateway}${imagesCID}/${imageName}`
          })()
        : ''
    const fallbackAnimationUrl =
      level === 10
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
            return `${gateway}${imagesCID}/IP10VIdeo.mp4`
          })()
        : ''
    return {
      level,
      imageUrl: fallbackImageUrl,
      animationUrl: fallbackAnimationUrl,
      tokenId,
      impactValue: null,
      dcuReward: null,
    }
  }
}

function HomeContent() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const searchParams = useSearchParams()
  const [showReferralNotification, setShowReferralNotification] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<Address | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && address) {
      (window as any).resetCleanup = (cleanupId?: string | number) => {
        if (cleanupId) {
          resetCleanupState(address as Address, cleanupId.toString())
        } else {
          resetAllCleanupState(address as Address)
        }
        console.log('Cleanup state reset. Please refresh the page.')
        window.location.reload()
      }
      // Helper to clear pre-fix cleanup (cleanup with rewarded=true but balance=0)
      (window as any).clearPreFixCleanup = async (cleanupId?: string | number) => {
        if (!cleanupId) {
          console.error('Please provide cleanup ID: window.clearPreFixCleanup(3)')
          return
        }
        try {
          const { markCleanupAsClaimed, clearPendingCleanup } = await import('@/lib/blockchain/verification')
          console.log(`[clearPreFixCleanup] Clearing pre-fix cleanup #${cleanupId} for ${address}`)

          // Mark as claimed to prevent it from showing again
          markCleanupAsClaimed(address as Address, BigInt(cleanupId))
          console.log(`[clearPreFixCleanup] Marked cleanup #${cleanupId} as claimed`)

          // Clear from pending cleanups
          clearPendingCleanup(address as Address)
          console.log(`[clearPreFixCleanup] Cleared pending cleanup`)

          // Also use resetCleanupState to ensure all related localStorage is cleared
          resetCleanupState(address as Address, cleanupId.toString())
          console.log(`[clearPreFixCleanup] Reset cleanup state`)

          console.log(`✅ Pre-fix cleanup #${cleanupId} cleared. Refreshing page...`)
          window.location.reload()
        } catch (error) {
          console.error('[clearPreFixCleanup] Error:', error)
          console.error('Falling back to manual reset...')
          resetCleanupState(address as Address, cleanupId.toString())
          window.location.reload()
        }
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('Reset functions available:')
        console.log('  window.resetCleanup(cleanupId?) - reset cleanup state')
        console.log('  window.clearPreFixCleanup(cleanupId) - clear pre-fix cleanup (e.g., cleanup #3)')
        console.log('  Example: window.resetCleanup(3) - reset cleanup #3')
        console.log('  Example: window.clearPreFixCleanup(3) - clear pre-fix cleanup #3')
      }
    }
  }, [address])
  const chainId = useResolvedChainId()
  const { submissionOwnerAddress, client: gaslessClient } = useSmartAccountClient()
  const { isVerifier: isVerifierUser } = useIsVerifier()
  const [cleanupStatus, setCleanupStatus] = useState<{
    hasPendingCleanup: boolean
    canClaim: boolean
    cleanupId?: bigint
    level?: number
  } | null>(null)
  const [showEarnModal, setShowEarnModal] = useState(false)
  const [hypercertEligibility, setHypercertEligibility] = useState<{
    cleanupCount: number
    hypercertCount: number
    isEligible: boolean
    testingOverride?: boolean
  } | null>(null)
  const [dcuBalance, setDcuBalance] = useState<bigint>(BigInt(0))
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [rewardStats, setRewardStats] = useState({
    cleanupsDCU: 0,
    cleanupsCount: 0,
    referralsDCU: 0,
    streakDCU: 0,
    reportsDCU: 0,
    hypercertsDCU: 0,
    verifierDCU: 0,
    userLevel: 0,
    /** Attribution-only: cleanups where you were listed as contributor on someone else's impact report (no DCU) */
    contributorCleanupCount: 0,
    impactReportsAttributed: 0,
  })
  const [impactProduct, setImpactProduct] = useState({
    level: 0,
    imageUrl: '',
    animationUrl: '',
    tokenId: null as bigint | null,
    impactValue: null as string | null,
    dcuReward: null as string | null,
  })
  const [mintingHypercert, setMintingHypercert] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimFeeInfo, setClaimFeeInfo] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  const [claimModal, setClaimModal] = useState<{
    variant: 'success' | 'error'
    title?: string
    message: string
  } | null>(null)
  const [notifyModal, setNotifyModal] = useState<{ variant: 'success' | 'error' | 'info'; title: string; message: string } | null>(null)
  /** False until first successful dashboard fetch for this session (avoids showing 000 while RPCs run). */
  const [hasLoadedDashboardOnce, setHasLoadedDashboardOnce] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle referral link detection - ONLY show notification if user was actually referred (check contract)
  useEffect(() => {
    if (!mounted || !address || !isConnected) return

    const checkReferral = async () => {
      try {
        const owner = submissionOwnerAddress ?? address
        // First, check if user was actually referred by checking the contract
        const { getUserReferrer } = await import('@/lib/blockchain/contracts')
        const contractReferrer = await getUserReferrer(owner)

        if (contractReferrer) {
          // User was actually referred - check if they've already submitted
          const submissions = await getUserSubmissions(owner)
          const hasSubmitted = submissions.length > 0

          // Also check if they have a pending cleanup (submitted but not yet verified/claimed)
          const currentStatus = await getUserCleanupStatus(owner)
          const hasPendingCleanup = currentStatus?.hasPendingCleanup || false

          if (hasSubmitted || hasPendingCleanup) {
            // User has already submitted or has pending cleanup - hide notification (one-time chance used)
            console.log('[Referral] User was referred but has already submitted or has pending cleanup - hiding notification')
            setShowReferralNotification(false)
            setReferrerAddress(contractReferrer) // Keep referrer address for stats, but don't show notification
          } else {
            // User was referred but hasn't submitted yet - show notification
            console.log('[Referral] ✅ User was referred by:', contractReferrer)
            setReferrerAddress(contractReferrer)

            // Check if notification was dismissed
            const dismissedKey = `referral_notification_dismissed_${contractReferrer.toLowerCase()}`
            const wasDismissed = localStorage.getItem(dismissedKey)
            if (!wasDismissed) {
              setShowReferralNotification(true)
            } else {
              console.log('[Referral] Notification was previously dismissed')
            }
          }
        } else {
          // Check if user has already submitted - if yes, they can't be referred again (one-time chance)
          const submissions = await getUserSubmissions(owner)
          const hasSubmitted = submissions.length > 0

          if (hasSubmitted) {
            // User has already submitted - ignore any referral links (one-time chance used)
            console.log('[Referral] User has already submitted - referral links are ignored (one-time chance)')
            setShowReferralNotification(false)
            setReferrerAddress(null)

            // Clear any pending referral from localStorage since it can't be used
            if (typeof window !== 'undefined') {
              const referrerKey = `referrer_${address.toLowerCase()}`
              const referrerPending = localStorage.getItem('referrer_pending')
              if (referrerPending) {
                localStorage.removeItem('referrer_pending')
              }
              localStorage.removeItem(referrerKey)
            }
          } else {
            // User hasn't submitted yet - check for referral link in URL
            let ref: string | null = null
            try {
              if (searchParams) {
                ref = searchParams.get('ref')
              }
            } catch (e) {
              // Ignore
            }

            if (!ref && typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search)
              ref = urlParams.get('ref')
            }

            if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
              const referrerAddr = ref as Address
              console.log('[Referral] Referral link in URL for new user, saving for future submission:', referrerAddr)

              // New user with referral link - show notification
              setReferrerAddress(referrerAddr)
              const dismissedKey = `referral_notification_dismissed_${referrerAddr.toLowerCase()}`
              const wasDismissed = localStorage.getItem(dismissedKey)
              if (!wasDismissed) {
                setShowReferralNotification(true)
              }

              // Persist referrer in localStorage for submission (will be used when they submit)
              if (typeof window !== 'undefined') {
                const referrerKey = `referrer_${address.toLowerCase()}`
                localStorage.setItem(referrerKey, referrerAddr)
                // Also save to pending for cases where address isn't available yet
                localStorage.setItem('referrer_pending', referrerAddr)
              }
            } else {
              // Check localStorage for saved referrer (user visited before but didn't submit)
              if (typeof window !== 'undefined') {
                const referrerKey = `referrer_${address.toLowerCase()}`
                const savedReferrer = localStorage.getItem(referrerKey)
                if (savedReferrer && /^0x[a-fA-F0-9]{40}$/.test(savedReferrer)) {
                  console.log('[Referral] Found saved referrer from previous visit:', savedReferrer)
                  setReferrerAddress(savedReferrer as Address)
                  const dismissedKey = `referral_notification_dismissed_${savedReferrer.toLowerCase()}`
                  const wasDismissed = localStorage.getItem(dismissedKey)
                  if (!wasDismissed) {
                    setShowReferralNotification(true)
                  }
                } else {
                  // Check pending referrer (for cases where address wasn't available)
                  const referrerPending = localStorage.getItem('referrer_pending')
                  if (referrerPending && /^0x[a-fA-F0-9]{40}$/.test(referrerPending)) {
                    console.log('[Referral] Found pending referrer from previous visit:', referrerPending)
                    setReferrerAddress(referrerPending as Address)
                    // Save it scoped to address now that we have it
                    localStorage.setItem(referrerKey, referrerPending)
                    const dismissedKey = `referral_notification_dismissed_${referrerPending.toLowerCase()}`
                    const wasDismissed = localStorage.getItem(dismissedKey)
                    if (!wasDismissed) {
                      setShowReferralNotification(true)
                    }
                  } else {
                    console.log('[Referral] User was not referred (no referrer in contract or URL/localStorage)')
                    setShowReferralNotification(false)
                    setReferrerAddress(null)
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[Referral] Error checking referral:', error)
      }
    }

    checkReferral()
  }, [mounted, address, isConnected, searchParams, submissionOwnerAddress])

  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      setHypercertEligibility(null)
      setHasLoadedDashboardOnce(false)
      return
    }

    setHasLoadedDashboardOnce(false)

    let cancelled = false

    async function checkStatus() {
      if (!address) return
      const owner = submissionOwnerAddress ?? address
      try {
        // Parallelize independent RPCs (was: submissions + sequential getCleanupDetails, then Promise.all; large waterfall).
        const [
          submissions,
          status,
          balance,
          rewardStatsData,
          level,
          tokenId,
          feeInfo,
          verifierCount,
        ] = await Promise.all([
          getUserSubmissions(owner),
          getUserCleanupStatus(owner),
          getDCUBalance(owner),
          getUserRewardStats(owner),
          getUserLevel(owner),
          getUserTokenId(owner),
          getClaimFee(),
          getVerifierRewardsCount(address as Address),
        ])
        setClaimFeeInfo(feeInfo)

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
          chainId: chainId ?? undefined,
        })
        const eligibility = {
          isEligible: eligibilityResult.eligible,
          cleanupCount: eligibilityResult.cleanupsCount,
          hypercertCount: 0, // for now, not using
          testingOverride: eligibilityResult.testingOverride
        }
        // Only update cleanup status if it's different from current state
        // This prevents re-showing claim button after it's been hidden
        if (process.env.NODE_ENV === 'development') {
          console.log('[Home] Cleanup status from getUserCleanupStatus:', status)
        }
        if (status) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Home] Setting cleanup status:', {
              hasPendingCleanup: status.hasPendingCleanup,
              canSubmit: status.canSubmit,
              canClaim: status.canClaim,
              cleanupId: status.cleanupId?.toString(),
              level: status.level,
              reason: status.reason,
            })
          }
          setCleanupStatus(status)
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Home] No cleanup status - clearing')
          }
          setCleanupStatus(null)
        }
        setHypercertEligibility(eligibility)
        setDcuBalance(balance)

        // Calculate breakdown from reward stats
        // Cleanups DCU = claimRewardsAmount (10 DCU per cleanup when NFT is claimed)
        // This represents completed cleanup cycles: submit → verify → claim NFT
        // The 10 DCU is distributed when user claims their Impact Product NFT level
        const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
        // Calculate cleanup count from DCU amount (10 DCU per cleanup/level)
        const cleanupsCount = Math.floor(cleanupsDCU / 10)
        // Referrals DCU
        const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
        // Streak DCU
        const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
        // Reports DCU (Enhanced Impact Reports)
        const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))

        if (process.env.NODE_ENV === 'development') {
          console.log('[Reward Stats] Full breakdown:', {
            cleanupsDCU,
            cleanupsCount,
            referralsDCU,
            streakDCU,
            reportsDCU,
            totalEarned: Number(formatEther(rewardStatsData.totalEarned)),
            currentBalance: Number(formatEther(rewardStatsData.currentBalance)),
            raw: {
              claimRewardsAmount: rewardStatsData.claimRewardsAmount.toString(),
              referralRewardsAmount: rewardStatsData.referralRewardsAmount.toString(),
              impactReportRewardsAmount: rewardStatsData.impactReportRewardsAmount.toString(),
              totalEarned: rewardStatsData.totalEarned.toString(),
            }
          })
        }

        // Dev-only: extra RPC avoided in production (uses data already loaded above)
        if (process.env.NODE_ENV === 'development' && cleanupsDCU === 0 && address) {
          const verifiedNotRejected = detailsList.filter(
            (d) => d && d.verified && !d.rejected
          ).length
          if (verifiedNotRejected > 0) {
            console.log(`[Reward Stats] User has ${verifiedNotRejected} verified cleanup(s) but cleanupsDCU is 0`)
            console.log('[Reward Stats] Cleanup verified but NFT not claimed yet; claim level for cleanup DCU')
          }
        }

        if (process.env.NODE_ENV === 'development' && referralsDCU === 0 && address) {
          try {
            const { getUserReferrer } = await import('@/lib/blockchain/contracts')
            const referrer = await getUserReferrer(owner)
            if (referrer) {
              console.log('[Reward Stats] User was referred by:', referrer, 'but referral rewards are 0')
            }
          } catch (error) {
            console.warn('[Reward Stats] Could not check referrer:', error)
          }
        }

        if (process.env.NODE_ENV === 'development' && reportsDCU === 0 && address && submissions.length > 0) {
          try {
            const first = detailsList[0]
            if (first?.hasImpactForm) {
              console.log(
                '[Reward Stats] Impact form on submission',
                submissions[0].toString(),
                'but impact report rewards are 0'
              )
            }
          } catch (error) {
            console.warn('[Reward Stats] Could not check impact forms:', error)
          }
        }
        // Hypercerts DCU (10 per hypercert, calculate from count)
        const hypercertsDCU = eligibility ? Number(eligibility.hypercertCount) * 10 : 0

        const verifierDCU = verifierCount

        const contribStats = await getContributorMentionStats(owner as Address)

        if (process.env.NODE_ENV === 'development') {
          console.log('[Dashboard] Verifier rewards:', {
            address,
            verifierCount,
            verifierDCU
          })
        }

        setRewardStats({
          cleanupsDCU,
          cleanupsCount,
          referralsDCU,
          streakDCU,
          reportsDCU,
          hypercertsDCU,
          verifierDCU,
          userLevel: level,
          contributorCleanupCount: contribStats.contributorCleanupCount,
          impactReportsAttributed: contribStats.impactReportsAttributed,
        })

        // IPFS metadata can be slow; don't block DCU / stats from rendering
        if (level > 0) {
          void loadImpactProductDisplay(level, tokenId)
            .then((display) => {
              if (!cancelled) setImpactProduct(display)
            })
            .catch((err) => {
              console.error('Error loading Impact Product metadata:', err)
              if (!cancelled) {
                setImpactProduct({
                  level,
                  imageUrl: '',
                  animationUrl: '',
                  tokenId,
                  impactValue: null,
                  dcuReward: null,
                })
              }
            })
        } else {
          setImpactProduct({
            level: 0,
            imageUrl: '',
            animationUrl: '',
            tokenId: null,
            impactValue: null,
            dcuReward: null,
          })
        }

      } catch (error) {
        console.error('Error checking status:', error)
      } finally {
        setHasLoadedDashboardOnce(true)
      }
    }

    checkStatus()

    // Poll when tab is visible (reduces idle RPC load)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void checkStatus()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [mounted, isConnected, address, submissionOwnerAddress, chainId])

  const handleMintHypercert = async () => {
    if (!address || !hypercertEligibility?.isEligible) return

    setMintingHypercert(true)
    try {
      const hypercertNumber = Number(hypercertEligibility.hypercertCount) + 1

      const result = await mintHypercert(address, hypercertNumber)

      const message =
        `Transaction: ${result.txHash}\n` +
        `Hypercert ID: ${result.hypercertId}\n` +
        `Metadata CID: ${result.metadataCid}\n\n` +
        `Your Hypercert is now onchain!`

      setNotifyModal({ variant: 'success', title: 'Hypercert minted', message })

      // Recalculate eligibility
      const mintOwner = submissionOwnerAddress ?? address
      const submissions = await getUserSubmissions(mintOwner)
      let verifiedCleanupsCount = 0
      let impactReportsCount = 0
      for (const id of submissions) {
        try {
          const details = await getCleanupDetails(id)
          if (details.verified) {
            verifiedCleanupsCount++
            if (details.hasImpactForm) impactReportsCount++
          }
        } catch (error) {
          // ignore
        }
      }
      const eligibilityResult = checkHypercertEligibility({
        cleanupsCount: verifiedCleanupsCount,
        reportsCount: impactReportsCount,
        chainId: chainId ?? undefined,
      })
      const newEligibility = {
        isEligible: eligibilityResult.eligible,
        cleanupCount: eligibilityResult.cleanupsCount,
        hypercertCount: 0,
        testingOverride: eligibilityResult.testingOverride
      }
      setHypercertEligibility(newEligibility)
    } catch (error) {
      console.error('Error minting hypercert:', error)

      // Provide user-friendly error messages
      let errorMessage = 'Unknown error occurred'
      if (error instanceof Error) {
        errorMessage = error.message
        // Make error messages more user-friendly
        if (errorMessage.includes('Network error')) {
          errorMessage = 'Network connection issue. Please check your internet and try again.'
        } else if (errorMessage.includes('IPFS')) {
          errorMessage = 'Failed to upload metadata. Please try again in a moment.'
        } else if (errorMessage.includes('transaction') || errorMessage.includes('wallet')) {
          errorMessage = 'Transaction failed. Please check your wallet and try again.'
        }
      }

      setNotifyModal({ variant: 'error', title: 'Mint failed', message: `Failed to mint hypercert:\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.` })
    } finally {
      setMintingHypercert(false)
    }
  }

  const handleClaimImpactLevel = async () => {
    if (cleanupStatus?.cleanupId === undefined || cleanupStatus?.cleanupId === null || isClaiming) {
      console.warn('[Home] Claim blocked:', {
        cleanupId: cleanupStatus?.cleanupId?.toString(),
        isClaiming,
      })
      return
    }

    try {
      setIsClaiming(true)

      await claimImpactProductFromVerification(
        cleanupStatus.cleanupId,
        gaslessClient ? { gaslessClient: gaslessClient as GaslessClient } : undefined
      )

      if (address && cleanupStatus.cleanupId !== undefined && cleanupStatus.cleanupId !== null) {
        const claimOwner = (submissionOwnerAddress ?? address) as Address
        console.log('[Home] Marking cleanup as claimed:', cleanupStatus.cleanupId.toString())
        markCleanupAsClaimed(claimOwner, cleanupStatus.cleanupId)
        const claimedKey = `claimed_cleanup_ids_${claimOwner.toLowerCase()}`
        const claimedIds = localStorage.getItem(claimedKey)
        console.log('[Home] Claimed cleanups after marking:', claimedIds)

        const variants = [...new Set([claimOwner.toLowerCase(), address.toLowerCase()])]
        for (const low of variants) {
          localStorage.removeItem(`pending_cleanup_id_${low}`)
          localStorage.removeItem(`pending_cleanup_location_${low}`)
        }
        console.log('[Home] Cleared pending cleanup from localStorage')
      }

      setClaimModal({
        variant: 'success',
        title: 'Impact Product claimed',
        message:
          'Onchain rewards were processed (cDCU is the token form of DCU rewards shown in your dashboard). Your Impact Product NFT was minted or upgraded.\n\nThe dashboard refreshes automatically in a few seconds. No need to reload the page.',
      })

      setCleanupStatus(null)
      setShowReferralNotification(false)

      await new Promise((resolve) => setTimeout(resolve, 5000))

      if (address) {
        const refreshOwner = (submissionOwnerAddress ?? address) as Address
        console.log('[Home] Refreshing cleanup status and reward stats after claim...')
        const status = await getUserCleanupStatus(refreshOwner)
        console.log('[Home] New cleanup status after claim:', status)
        setCleanupStatus(status)

        const submissions = await getUserSubmissions(refreshOwner)
        let verifiedCleanupsCount = 0
        let impactReportsCount = 0
        for (const id of submissions) {
          try {
            const details = await getCleanupDetails(id)
            if (details.verified) {
              verifiedCleanupsCount++
              if (details.hasImpactForm) impactReportsCount++
            }
          } catch (error) {
            // ignore
          }
        }
        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanupsCount,
          reportsCount: impactReportsCount,
          chainId: chainId ?? undefined,
        })
        const eligibility = {
          isEligible: eligibilityResult.eligible,
          cleanupCount: eligibilityResult.cleanupsCount,
          hypercertCount: 0,
          testingOverride: eligibilityResult.testingOverride,
        }
        setHypercertEligibility(eligibility)

        console.log('[Home] Refreshing reward stats to see updated breakdown...')
        try {
          const [balance, rewardStatsData, level, tokenId] = await Promise.all([
            getDCUBalance(refreshOwner),
            getUserRewardStats(refreshOwner),
            getUserLevel(refreshOwner),
            getUserTokenId(refreshOwner),
          ])
          setDcuBalance(balance)

          const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
          const cleanupsCount = Math.floor(cleanupsDCU / 10)
          const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
          const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
          const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))

          const hypercertsDCU = eligibility ? Number(eligibility.hypercertCount) * 10 : 0

          const { getVerifierRewardsCount } = await import('@/lib/blockchain/contracts')
          const verifierCount = await getVerifierRewardsCount(address as Address)
          const verifierDCU = verifierCount

          const contribAfter = await getContributorMentionStats(refreshOwner)

          if (process.env.NODE_ENV === 'development') {
            console.log('[Dashboard] Verifier rewards (after claim):', {
              address,
              verifierCount,
              verifierDCU,
            })
          }

          setRewardStats({
            cleanupsDCU,
            cleanupsCount,
            referralsDCU,
            streakDCU,
            reportsDCU,
            hypercertsDCU,
            verifierDCU,
            userLevel: level,
            contributorCleanupCount: contribAfter.contributorCleanupCount,
            impactReportsAttributed: contribAfter.impactReportsAttributed,
          })

          if (level > 0) {
            try {
              const display = await loadImpactProductDisplay(level, tokenId)
              setImpactProduct(display)
            } catch (error) {
              console.warn('[Home] Could not fetch Impact Product metadata after claim:', error)
            }
          }
        } catch (error) {
          console.error('[Home] Error refreshing reward stats after claim:', error)
        }
      }

      console.log('[Home] Refreshing data to see updated balance and NFT...')
    } catch (error: any) {
      console.error('Error claiming:', error)
      const errorMessage = error?.message || String(error)
      setClaimModal({
        variant: 'error',
        title: 'Claim failed',
        message: `Failed to claim: ${errorMessage}`,
      })
    } finally {
      setIsClaiming(false)
    }
  }

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  // Hero before login: one viewport, no scroll (tight vertical space only)
  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col bg-background">
        <main className="container mx-auto flex flex-1 min-h-0 flex-col items-center justify-center px-4 py-2 sm:py-4">
          <div className="w-full max-w-3xl space-y-4 sm:space-y-5 text-center">
            {/* Hero Heading: less space above/below */}
            <div className="space-y-2 animate-fade-in-up">
              <h1 className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-bebas-neue), sans-serif', letterSpacing: '0.05em', lineHeight: 1.1 }}>
                <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent animate-pulse">
                  DeCleanup
                </span>{" "}
                Rewards
              </h1>
              <h2 className="font-sans text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl font-normal mx-auto max-w-2xl normal-case break-words">
                Log cleanups. Build a verified record. Earn your voice in the network.
              </h2>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-1 animate-fade-in-up font-sans">
              <WalletConnect />
              <Link
                href="https://www.decleanup.net/userguide"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted-foreground hover:text-brand-green transition-colors underline underline-offset-4"
              >
                How it works
              </Link>
            </div>
            <p className="font-sans text-xs text-muted-foreground/80">
              Connect your wallet to start cleaning
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6 flex-shrink-0">
          <div className="container mx-auto px-4">
            <div className="font-sans flex flex-col items-center gap-4 text-xs text-muted-foreground sm:text-sm">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-6">
                <a href="https://decleanup.net" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Website
                </a>
                <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  GitHub
                </a>
                <a href="https://decleanup.net/litepaper" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Litepaper
                </a>
                <a href="https://decleanup.net/tokenomics" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Tokenomics
                </a>
                <a href="https://x.com/decleanupnet" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Follow on X
                </a>
                <a href="https://farcaster.xyz/decleanupnet" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Farcaster
                </a>
                <a href="https://t.me/decentralizedcleanup" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Telegram
                </a>
                <a href="https://giveth.io/project/decentralized-cleanup-network" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-green transition-colors">
                  Donate on Giveth
                </a>
              </div>
              <div className="font-sans flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest opacity-50">
                <span>Built on</span>
                <span className="font-bold">CELO</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // Dashboard after login
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 sm:gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header Section: gradient + pulse on first word (DeCleanupLandingPage HeroSection) */}
        <div className="mb-2 min-w-0 max-w-3xl animate-fade-in-up space-y-2 sm:space-y-3">
          <h1
            className="py-1 font-bebas text-3xl leading-none tracking-wider sm:py-2 sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ fontFamily: 'var(--font-bebas-neue), sans-serif', letterSpacing: '0.05em', lineHeight: 1.1 }}
          >
            <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent animate-pulse">
              DeCleanup
            </span>{' '}
            Rewards
          </h1>
          <h2 className="font-sans text-sm font-normal normal-case leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            Log cleanups. Build a verified record. Earn your voice in the network.
          </h2>
        </div>

        {/* Referral Notification - Only show if user hasn't submitted yet */}
        {showReferralNotification && referrerAddress && (
          <div className="rounded-lg border-2 border-brand-green bg-brand-green/10 p-4 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Users className="h-5 w-5 text-brand-green" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">
                  🎉 You Were Invited!
                </h3>
                <p className="text-sm text-gray-300">
                  You've been referred to DeCleanup Rewards! When you submit your first cleanup, get it verified, and claim your first Impact Product level, both you and your referrer will earn <strong className="text-white">3 DCU</strong> each as referral rewards. Additionally, you'll receive <strong className="text-white">10 DCU</strong> for claiming your first level (separate from referral rewards).
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Your referrer will be automatically credited when you claim your first level.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/cleanup">
                    <Button className="bg-brand-green text-black hover:bg-[#4a9a26]">
                      Submit Your First Cleanup
                    </Button>
                  </Link>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReferralNotification(false)
                  // Remember dismissal so we don't show it again for this referrer
                  if (referrerAddress) {
                    const dismissedKey = `referral_notification_dismissed_${referrerAddress.toLowerCase()}`
                    localStorage.setItem(dismissedKey, 'true')
                  }
                }}
                className="flex-shrink-0 text-gray-400 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hero Section: Impact Product */}
        <div className="mb-6">
          {impactProduct.level > 0 ? (
            <DashboardImpactProduct
              level={impactProduct.level}
              imageUrl={impactProduct.imageUrl}
              animationUrl={impactProduct.animationUrl}
              dcuAttached={impactProduct.dcuReward ? Number(impactProduct.dcuReward) : impactProduct.level * 10}
              impactValue={impactProduct.impactValue}
              tokenId={impactProduct.tokenId}
              contractAddress={CONTRACT_ADDRESSES.IMPACT_PRODUCT || ''}
              onNotify={(p) => setNotifyModal({ ...p, variant: p.variant || 'info' })}
            />
          ) : cleanupStatus?.canClaim ? (
            <div className="flex min-h-[min(70dvh,420px)] flex-col rounded-2xl border border-brand-yellow/30 bg-card p-5 sm:min-h-[500px] sm:p-8">
              <SectionHeading icon={Award}>IMPACT PRODUCT</SectionHeading>

              <div className="flex flex-1 flex-col items-center justify-center text-center min-h-0">
                <div className="mb-4 w-full max-w-md rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
                  <p className="text-sm sm:text-base text-brand-yellow">
                    Your cleanup is verified! Claim your Impact Product (Level {cleanupStatus.level ?? 1}) to mint your
                    NFT and unlock rewards.
                  </p>
                </div>
                <div className="mb-4 rounded-2xl border-2 border-brand-yellow/40 bg-gradient-to-br from-brand-yellow/10 to-transparent p-8 sm:p-12">
                  <Award className="h-16 w-16 sm:h-20 sm:w-20 text-brand-yellow mx-auto" />
                </div>
                <h3 className="mb-2 font-bebas text-2xl sm:text-3xl tracking-wider text-foreground">
                  READY TO CLAIM
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground sm:text-base">
                  Complete your claim to mint Level {cleanupStatus.level ?? 1}.
                </p>
                <Button
                  type="button"
                  onClick={handleClaimImpactLevel}
                  disabled={isClaiming}
                  className="mt-4 gap-2 bg-brand-yellow px-6 py-2.5 sm:px-8 sm:py-3 font-bebas text-sm sm:text-base tracking-wider text-black hover:bg-brand-yellow/90 disabled:opacity-50"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      CLAIMING...
                    </>
                  ) : (
                    <>
                      <Award className="h-4 w-4" />
                      CLAIM LEVEL
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[min(70dvh,420px)] flex-col rounded-2xl border border-border bg-card p-5 sm:min-h-[500px] sm:p-8">
              <SectionHeading icon={Award}>IMPACT PRODUCT</SectionHeading>

              <div className="flex flex-1 flex-col items-center justify-center text-center min-h-0">
                <div className="mb-4 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand-green/5 to-transparent p-8 sm:p-12">
                  <Award className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground/50 mx-auto" />
                </div>
                <h3 className="mb-2 font-bebas text-2xl sm:text-3xl tracking-wider text-foreground">
                  NOT YET MINTED
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground max-w-xs">
                  Submit your first cleanup to earn your Impact Product and start your journey
                </p>
                <Link href="/cleanup" className="mt-4">
                  <Button className="gap-2 bg-brand-yellow px-6 py-2.5 sm:px-8 sm:py-3 font-bebas text-sm sm:text-base tracking-wider text-black hover:bg-brand-yellow/90">
                    <Leaf className="h-4 w-4" />
                    GET STARTED
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Verifier Apply Card */}
        <VerifierApplyCard />

        {/* Explore: full-width row — avoids cramped 3-col squeeze beside stats on phones */}
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <Link href="/leaderboard" className="block min-h-[88px]">
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-green/50">
              <Trophy className="mb-2 h-5 w-5 shrink-0 text-brand-yellow" aria-hidden />
              <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">LEADERBOARD</h3>
              <p className="text-xs text-muted-foreground">Top contributors</p>
            </div>
          </Link>

          {isConnected && (
            <Link href="/verifier" className="block min-h-[88px]">
              <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-green/50">
                <CheckSquare className="mb-2 h-5 w-5 shrink-0 text-brand-green" aria-hidden />
                <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">VERIFIER CABINET</h3>
                <p className="text-xs text-muted-foreground">Verify cleanups</p>
              </div>
            </Link>
          )}

          <Link href="/hypercerts" className="block min-h-[88px]">
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-green/50">
              <Heart className="mb-2 h-5 w-5 shrink-0 text-brand-yellow" aria-hidden />
              <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">HYPERCERTS</h3>
              <p className="text-xs text-muted-foreground">Impact certificates</p>
            </div>
          </Link>

          {hypercertEligibility?.isEligible && (
            <div className="min-[480px]:col-span-2 lg:col-span-3">
              <div className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
                <Heart className="mb-2 h-5 w-5 text-brand-yellow" aria-hidden />
                <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">
                  HYPERCERT
                  {hypercertEligibility.testingOverride && (
                    <span className="ml-2 text-xs font-normal text-brand-yellow/70">(Sepolia Testnet)</span>
                  )}
                </h3>
                <Button
                  onClick={handleMintHypercert}
                  disabled={mintingHypercert}
                  size="sm"
                  className="h-8 w-full gap-1 bg-brand-yellow text-xs text-black hover:bg-brand-yellow/90 disabled:opacity-50"
                >
                  {mintingHypercert ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Heart className="h-3 w-3" />
                      MINT
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Stats Section */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-2">
            {/* Stats Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <SectionHeading
                icon={TrendingUp}
                aside={
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEarnModal(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-brand-green/30 bg-brand-green/10 px-2.5 py-1.5 text-brand-green transition-colors hover:bg-brand-green/20 sm:gap-2 sm:px-3 sm:py-2"
                      title="Learn how to earn more DCU"
                    >
                      <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      <span className="font-bebas text-xs tracking-wide sm:text-sm">How to earn</span>
                    </button>
                    {address && (
                      <Link
                        href={`/impact/${address}${
                          submissionOwnerAddress &&
                          submissionOwnerAddress.toLowerCase() !== address.toLowerCase()
                            ? `?sa=${submissionOwnerAddress}`
                            : ''
                        }`}
                        className="text-xs font-sans font-medium text-brand-green underline underline-offset-4 hover:text-brand-green/90"
                      >
                        Public portfolio
                      </Link>
                    )}
                  </>
                }
              >
                YOUR STATS
              </SectionHeading>

              {/* Total Balances - Always Visible */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 transition-all hover:border-brand-green/50 hover:bg-brand-green/10">
                  <div className="mb-2">
                    <span className="text-xs font-sans font-semibold tracking-wide text-muted-foreground">
                      Total DCU
                    </span>
                  </div>
                  <p className="font-bebas text-3xl text-brand-green leading-none min-h-[2.25rem] flex items-center">
                    {!hasLoadedDashboardOnce ? (
                      <Loader2 className="h-8 w-8 animate-spin text-brand-green/80" aria-hidden />
                    ) : (
                      (
                        rewardStats.cleanupsDCU +
                        rewardStats.referralsDCU +
                        rewardStats.streakDCU +
                        rewardStats.reportsDCU +
                        rewardStats.hypercertsDCU +
                        rewardStats.verifierDCU
                      ).toFixed(0)
                    )}
                  </p>
                  <p className="mt-2 font-sans text-[11px] leading-snug text-muted-foreground">
                    Sum of categories in the breakdown below (Reward Manager accounting).
                  </p>
                </div>
                {address && <DashboardClaimCdcu address={address} />}
              </div>

              {/* Expandable Breakdown */}
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3 hover:bg-background/50 transition-colors"
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Breakdown
                </span>
                {showBreakdown ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showBreakdown && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Cleanups', value: rewardStats.cleanupsDCU.toFixed(0), showToken: true, count: rewardStats.cleanupsCount.toString() },
                    { label: 'Referrals', value: rewardStats.referralsDCU.toFixed(0), showToken: true },
                    { label: 'Streak', value: rewardStats.streakDCU.toFixed(0), showToken: true },
                    { label: 'Reports', value: rewardStats.reportsDCU.toFixed(0), showToken: true },
                    { label: 'Hypercerts', value: rewardStats.hypercertsDCU.toFixed(0), showToken: true, count: hypercertEligibility ? Number(hypercertEligibility.hypercertCount).toString() : '0' },
                    { label: 'Verifier', value: rewardStats.verifierDCU.toFixed(0), showToken: true },
                    {
                      label: 'As contributor',
                      value: String(rewardStats.contributorCleanupCount),
                      showToken: false,
                      count: rewardStats.impactReportsAttributed > 0 ? `${rewardStats.impactReportsAttributed} rep.` : undefined,
                      suffix: ' cleanups',
                      sub: 'Attribution only, no DCU',
                    },
                  ].map((stat) => (
                      <div key={stat.label} className="rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-brand-green/50 hover:bg-background">
                        <div className="mb-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {stat.label}
                            {stat.count && ` (${stat.count})`}
                          </span>
                        </div>
                        <p className="font-bebas text-2xl text-foreground leading-none min-h-[2rem] flex flex-col gap-0.5">
                          {!hasLoadedDashboardOnce ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                          ) : (
                            <>
                              <span>
                                {stat.value}
                                {stat.showToken ? ' DCU' : `${'suffix' in stat && stat.suffix ? stat.suffix : ''}`}
                              </span>
                              {'sub' in stat && stat.sub ? (
                                <span className="font-sans text-[10px] font-normal normal-case text-muted-foreground">
                                  {stat.sub}
                                </span>
                              ) : null}
                            </>
                          )}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex flex-col lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 flex-1 overflow-auto">
              {/* Action Buttons - Use DashboardActions for proper state management */}
              <div className="flex-shrink-0">
                <DashboardActions
                  address={address || ''}
                  userImpactLevel={rewardStats.userLevel}
                  cleanupStatus={cleanupStatus || null}
                  claimFeeInfo={claimFeeInfo}
                  onClaim={handleClaimImpactLevel}
                  isClaiming={isClaiming}
                  onNotify={(p) => setNotifyModal({ ...p, variant: p.variant || 'info' })}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {claimModal && (
        <AlertModal
          isOpen
          onClose={() => setClaimModal(null)}
          title={
            claimModal.title ??
            (claimModal.variant === 'success' ? 'Impact Product claimed' : 'Claim failed')
          }
          message={claimModal.message}
          variant={claimModal.variant}
        />
      )}
      {notifyModal && (
        <AlertModal
          isOpen
          onClose={() => setNotifyModal(null)}
          title={notifyModal.title}
          message={notifyModal.message}
          variant={notifyModal.variant}
        />
      )}

      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-foreground uppercase">
                How to earn more DCU
              </h2>
              <button
                onClick={() => setShowEarnModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">1. Impact Product Claims</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 DCU per level by submitting before-and-after cleanup photos, waiting for verification and level upgrade. Each set of 10 cleanups mints a Hypercert and awards an additional 10 DCU. Currently 10 levels available, with more to come.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">2. Referrals</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 DCU for each user who joins via your link, submits cleanup photos, gets it verified and claims an Impact Product.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">3. Streaks</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 DCU per level if you submit cleanups at least once per week to maintain your streak.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">4. Enhanced Impact Report</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 5 DCU if you submit optional form after each cleanup - used to generate your onchain impact certificate Hypercert (after 10 cleanups).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">5. Become Verifier</h3>
                <p className="text-sm text-muted-foreground">
                  Stake 100 DCU to get access to verifier cabinet and earn 1 DCU per verified submission.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">6. Hypercert Creation</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 DCU when you mint a Hypercert after completing every 10 verified cleanups. Hypercerts are onchain impact certificates that represent your environmental contributions.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowEarnModal(false)}
              className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
            >
              Got It
            </Button>
          </div>
        </div>
      )}

      <footer className="border-t border-border py-8 mt-12 flex-shrink-0">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {[
                { label: 'Website', href: 'https://decleanup.net' },
                { label: 'GitHub', href: 'https://github.com/DeCleanup-Network' },
                { label: 'Litepaper', href: 'https://decleanup.net/litepaper' },
                { label: 'Tokenomics', href: 'https://decleanup.net/tokenomics' },
                { label: 'Follow on X', href: 'https://x.com/decleanupnet' },
                { label: 'Farcaster', href: 'https://farcaster.xyz/decleanupnet' },
                { label: 'Telegram', href: 'https://t.me/decentralizedcleanup' },
                { label: 'Donate on Giveth', href: 'https://giveth.io/project/decleanup-network-cleaning-the-planet-empowering-communities' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-normal text-muted-foreground hover:text-brand-green transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest opacity-30 select-none">
              <span className="font-sans">Built on</span>
              <span className="font-bold">CELO</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
