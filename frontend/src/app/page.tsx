'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAccount } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import {
  Leaf,
  Award,
  Clock,
  Users,
  Heart,
  Trophy,
  CheckSquare,
  Loader2,
  X,
  TrendingUp,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
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
  isVerifier,
  type GaslessClient,
} from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CONTRACT_ADDRESSES, MAX_IMPACT_PRODUCT_LEVEL } from '@/lib/blockchain/chain-constants'
import { VERIFIER_CONFIG } from '@/config/verifier'
import { getContributorMentionStats } from '@/lib/impact/contributor-stats'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { VerifierApplyCard } from '@/components/dashboard/VerifierApplyCard'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { DashboardClaimCdcu } from '@/components/dashboard/DashboardClaimCdcu'
import { FeeDisplay } from '@/components/ui/fee-display'
import { AlertModal } from '@/components/ui/alert-modal'
import { markCleanupAsClaimed, clearPendingCleanup } from '@/lib/blockchain/verification'
import { resetCleanupState, resetAllCleanupState } from '@/lib/utils/reset-cleanup'
import { DashboardReferralLinkCard } from '@/components/dashboard/DashboardReferralLinkCard'
import { ReferralInviteMessage } from '@/components/referral/ReferralInviteMessage'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { fetchViaIpfsGatewayProxy } from '@/lib/utils/ipfs-gateway-proxy'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { cn } from '@/lib/utils'
import type { Address } from 'viem'

const WalletConnect = dynamic(
  () =>
    import('@/features/wallet/components/WalletConnect').then((m) => ({
      default: m.WalletConnect,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="inline-flex h-10 min-w-[10rem] items-center justify-center rounded-md border border-border bg-muted/50 px-4 text-sm text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </div>
    ),
  }
)

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

function convertIPFSToGateway(ipfsUrl: string): string {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl
  }
  let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
  if (path.startsWith('/')) path = path.substring(1)

  const defaultGateways = [
    'https://ipfs.io/ipfs/',
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
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
    'https://ipfs.io/ipfs/',
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
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
  metadataName: string | null
  metadataDescription: string | null
  metadataExternalUrl: string | null
  metadataAttributes: { trait_type: string; value: string }[]
}

/** Load Impact Product image/metadata; prefers tokenId-based URI when minted. */
async function loadImpactProductDisplay(level: number, tokenId: bigint | null): Promise<ImpactProductDisplayState> {
  const emptyExtras = {
    metadataName: null as string | null,
    metadataDescription: null as string | null,
    metadataExternalUrl: null as string | null,
    metadataAttributes: [] as { trait_type: string; value: string }[],
  }
  if (level <= 0) {
    return {
      level: 0,
      imageUrl: '',
      animationUrl: '',
      tokenId: null,
      ...emptyExtras,
    }
  }

  let metadataName: string | null = null
  let metadataDescription: string | null = null
  let metadataExternalUrl: string | null = null
  let metadataAttributes: { trait_type: string; value: string }[] = []

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

    if (tokenURI) {
      try {
        const metadataResponse = await fetchWithFallback(tokenURI)
        if (metadataResponse.ok) {
          const metadata = await parseMetadataJsonFromResponse(metadataResponse)

          metadataName = metadata?.name ?? null
          metadataDescription = metadata?.description ?? null
          metadataExternalUrl = metadata?.external_url ?? null
          metadataAttributes = (metadata?.attributes ?? [])
            .filter((a) => a?.trait_type != null)
            .map((a) => ({
              trait_type: String(a.trait_type),
              value: a.value != null ? String(a.value) : '—',
            }))

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
            const gateway = 'https://ipfs.io/ipfs/'
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
            const gateway = 'https://ipfs.io/ipfs/'
            return `${gateway}${imagesCID}/IP10VIdeo.mp4`
          })()
        : '')

    return {
      level,
      imageUrl: finalImageUrl,
      animationUrl: finalAnimationUrl,
      tokenId,
      metadataName,
      metadataDescription,
      metadataExternalUrl,
      metadataAttributes,
    }
  } catch (error) {
    console.error('Error fetching Impact Product data:', error)
    const fallbackImageUrl =
      level > 0
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = 'https://ipfs.io/ipfs/'
            const imageName = level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`
            return `${gateway}${imagesCID}/${imageName}`
          })()
        : ''
    const fallbackAnimationUrl =
      level === 10
        ? (() => {
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            const gateway = 'https://ipfs.io/ipfs/'
            return `${gateway}${imagesCID}/IP10VIdeo.mp4`
          })()
        : ''
    return {
      level,
      imageUrl: fallbackImageUrl,
      animationUrl: fallbackAnimationUrl,
      tokenId,
      metadataName,
      metadataDescription,
      metadataExternalUrl,
      metadataAttributes,
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
  const rewardIdentityAddress = (submissionOwnerAddress ?? address ?? undefined) as Address | undefined
  const [isRewardIdentityVerifier, setIsRewardIdentityVerifier] = useState(false)
  const [showVerifierRulesModal, setShowVerifierRulesModal] = useState(false)
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
    /** RewardManager `totalEarned` (wei → DCU); same basis as $cDCU milestone API. */
    totalEarnedDCU: 0,
    /** `claimRewardsAmount`: DCU from `rewardImpactProductClaim` only (requires NFT `impactClaimRewardsEnabled`). */
    cleanupsDCU: 0,
    /** Verified cleanups from indexer/contract details (for UX copy; onchain cleanup DCU still comes from claimRewardsAmount). */
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
    /** Attribution-only: cleanups where you were listed as contributor on someone else's impact report (no DCU) */
    contributorCleanupCount: 0,
    impactReportsAttributed: 0,
  })
  const [impactProduct, setImpactProduct] = useState({
    level: 0,
    imageUrl: '',
    animationUrl: '',
    tokenId: null as bigint | null,
    metadataName: null as string | null,
    metadataDescription: null as string | null,
    metadataExternalUrl: null as string | null,
    metadataAttributes: [] as { trait_type: string; value: string }[],
  })
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimFeeInfo, setClaimFeeInfo] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  const [claimModal, setClaimModal] = useState<{
    variant: 'success' | 'error'
    title?: string
    message: string
  } | null>(null)
  /** Prevents double refresh when OK, Escape, and auto-close all fire. */
  const claimSuccessHandledRef = useRef(false)
  const claimRefreshAfterModalRef = useRef<(() => Promise<void>) | null>(null)
  const [notifyModal, setNotifyModal] = useState<{ variant: 'success' | 'error' | 'info'; title: string; message: string } | null>(null)
  /** False until first successful dashboard fetch for this session (avoids showing 000 while RPCs run). */
  const [hasLoadedDashboardOnce, setHasLoadedDashboardOnce] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!rewardIdentityAddress) {
      setIsRewardIdentityVerifier(false)
      return
    }
    void isVerifier(rewardIdentityAddress)
      .then((v) => {
        if (!cancelled) setIsRewardIdentityVerifier(v)
      })
      .catch(() => {
        if (!cancelled) setIsRewardIdentityVerifier(false)
      })
    return () => {
      cancelled = true
    }
  }, [rewardIdentityAddress])

  // Handle referral link detection - ONLY show notification if user was actually referred (check contract)
  useEffect(() => {
    if (!mounted || !address || !isConnected) return

    const checkReferral = async () => {
      try {
        if (!submissionOwnerAddress) return
        const owner = submissionOwnerAddress
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
      if (!submissionOwnerAddress) return
      const owner = submissionOwnerAddress
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
        let recyclablesTaggedCount = 0
        for (const details of detailsList) {
          if (details?.verified) {
            verifiedCleanupsCount++
            if (details.hasImpactForm) impactReportsCount++
            if (details.hasRecyclables) recyclablesTaggedCount++
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
        // "Impact levels" DCU = claimRewardsAmount (filled by `rewardImpactProductClaim` on the NFT contract).
        // That hook only runs when the deployed NFT has `impactClaimRewardsEnabled` — mint/upgrade can still succeed with it off.
        const totalEarnedDCU = Number(formatEther(rewardStatsData.totalEarned))
        const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
        const cleanupsCount = Math.floor(cleanupsDCU / 10)
        // Referrals DCU
        const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
        // Streak DCU
        const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
        // Reports DCU (impact reports) and recyclables DCU (separate onchain buckets, 5 each per verified submission)
        const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
        const recyclablesDCU = Number(formatEther(rewardStatsData.recyclablesRewardsAmount))

        if (process.env.NODE_ENV === 'development') {
          console.log('[Reward Stats] Full breakdown:', {
            totalEarnedDCU,
            cleanupsDCU,
            cleanupsCount,
            referralsDCU,
            streakDCU,
            reportsDCU,
            recyclablesDCU,
            recyclablesTaggedCount,
            totalEarned: Number(formatEther(rewardStatsData.totalEarned)),
            currentBalance: Number(formatEther(rewardStatsData.currentBalance)),
            raw: {
              claimRewardsAmount: rewardStatsData.claimRewardsAmount.toString(),
              referralRewardsAmount: rewardStatsData.referralRewardsAmount.toString(),
              impactReportRewardsAmount: rewardStatsData.impactReportRewardsAmount.toString(),
              recyclablesRewardsAmount: rewardStatsData.recyclablesRewardsAmount.toString(),
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
            console.log(
              `[Reward Stats] ${verifiedNotRejected} verified cleanup(s) in history but claimRewardsAmount (impact-level ledger) is 0 — you may also have a newer submission still pending review; counts all verified IDs.`
            )
            console.log(
              '[Reward Stats] Expected if ImpactProductNFT.impactClaimRewardsEnabled is false on-chain, or level rewards reverted; mint/upgrade can still succeed without this bucket.'
            )
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
          const verifiedWithForm = detailsList.filter((d) => d?.verified && !d.rejected && d.hasImpactForm).length
          const verifiedWithRecyclables = detailsList.filter((d) => d?.verified && !d.rejected && d.hasRecyclables).length
          if (verifiedWithForm > 0 || verifiedWithRecyclables > 0) {
            console.log(
              '[Reward Stats] On-chain RewardManager buckets: impact reports',
              reportsDCU,
              'DCU, recyclables',
              recyclablesDCU,
              'DCU. Verified cleanups with impact hash:',
              verifiedWithForm,
              'with recyclables:',
              verifiedWithRecyclables,
              '— if these counts are >0 but buckets stay 0, claim level must run claimSubmissionBonusRewards for each submission (after mint); old submissions may have claimed bonus before flags existed.'
            )
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
          totalEarnedDCU,
          cleanupsDCU,
          verifiedCleanupsCount: verifiedCleanupsCount,
          cleanupsCount,
          referralsDCU,
          streakDCU,
          reportsDCU,
          recyclablesDCU,
          impactReportsCount: Math.floor(reportsDCU / 5),
          recyclablesTaggedCount: Math.floor(recyclablesDCU / 5),
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
                  metadataName: null,
                  metadataDescription: null,
                  metadataExternalUrl: null,
                  metadataAttributes: [],
                })
              }
            })
        } else {
          setImpactProduct({
            level: 0,
            imageUrl: '',
            animationUrl: '',
            tokenId: null,
            metadataName: null,
            metadataDescription: null,
            metadataExternalUrl: null,
            metadataAttributes: [],
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

  const handleClaimImpactLevel = async () => {
    if (cleanupStatus?.cleanupId === undefined || cleanupStatus?.cleanupId === null || isClaiming) {
      console.warn('[Home] Claim blocked:', {
        cleanupId: cleanupStatus?.cleanupId?.toString(),
        isClaiming,
      })
      return
    }
    if (!submissionOwnerAddress) {
      console.warn('[Home] Claim blocked: submission owner not ready (gasless wallet still loading)')
      return
    }

    try {
      setIsClaiming(true)

      await claimImpactProductFromVerification(
        cleanupStatus.cleanupId,
        gaslessClient ? { gaslessClient: gaslessClient as GaslessClient } : undefined
      )

      if (address && cleanupStatus.cleanupId !== undefined && cleanupStatus.cleanupId !== null) {
        const claimOwner = submissionOwnerAddress as Address
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

      claimSuccessHandledRef.current = false
      setClaimModal({
        variant: 'success',
        title: 'Impact Product claimed',
        message:
          'Onchain rewards were processed, your Impact Product was minted or upgraded',
      })

      setCleanupStatus(null)
      setShowReferralNotification(false)

      const runRefreshAfterClaim = async () => {
        if (!address) return
        const refreshOwner = submissionOwnerAddress as Address
        console.log('[Home] Refreshing cleanup status and reward stats after claim...')
        const status = await getUserCleanupStatus(refreshOwner)
        console.log('[Home] New cleanup status after claim:', status)
        setCleanupStatus(status)

        const submissions = await getUserSubmissions(refreshOwner)
        let verifiedCleanupsCount = 0
        let impactReportsCount = 0
        let recyclablesTaggedCount = 0
        for (const id of submissions) {
          try {
            const details = await getCleanupDetails(id)
            if (details.verified) {
              verifiedCleanupsCount++
              if (details.hasImpactForm) impactReportsCount++
              if (details.hasRecyclables) recyclablesTaggedCount++
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

          const totalEarnedDCU = Number(formatEther(rewardStatsData.totalEarned))
          const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
          const cleanupsCount = Math.floor(cleanupsDCU / 10)
          const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
          const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
          const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
          const recyclablesDCU = Number(formatEther(rewardStatsData.recyclablesRewardsAmount))

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
            totalEarnedDCU,
            cleanupsDCU,
            verifiedCleanupsCount: verifiedCleanupsCount,
            cleanupsCount,
            referralsDCU,
            streakDCU,
            reportsDCU,
            recyclablesDCU,
            impactReportsCount: Math.floor(reportsDCU / 5),
            recyclablesTaggedCount: Math.floor(recyclablesDCU / 5),
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
        console.log('[Home] Refreshing data to see updated balance and NFT...')
      }

      claimRefreshAfterModalRef.current = runRefreshAfterClaim
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

        <div className="w-full border-t border-brand-green/25 bg-brand-green/10 py-4">
          <div className="container mx-auto flex flex-col items-center justify-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
              Past contributors can claim $cDCU airdrop here.
            </p>
            <Button asChild className="shrink-0 bg-brand-green text-black hover:bg-brand-green/90">
              <Link href="/airdrop">Claim airdrop</Link>
            </Button>
          </div>
        </div>

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
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                <Link href="/guide" className="font-medium hover:text-brand-green transition-colors">
                  User Guide
                </Link>
                <Link href="/terms" className="font-medium hover:text-brand-green transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="font-medium hover:text-brand-green transition-colors">
                  Privacy Policy
                </Link>
              </div>
              <div className="font-sans flex items-center justify-center gap-2 text-xs uppercase tracking-widest opacity-40 sm:text-sm">
                <span className="font-medium">Built on</span>
                <img
                  src="/celo-celo-logo.svg"
                  alt="Celo"
                  className="h-5 w-auto rounded-sm sm:h-6"
                />
              </div>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  const canHeroSubmit =
    !cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim && rewardStats.userLevel < MAX_IMPACT_PRODUCT_LEVEL
  const heroMaxLevelLocked = rewardStats.userLevel >= MAX_IMPACT_PRODUCT_LEVEL
  const showHeroClaimCta = !!cleanupStatus?.canClaim
  const showHeroUnderReview = !!cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim

  /** Hero primary CTA: full-width on mobile; centered fixed span from sm up */
  const heroCtaClass =
    'h-auto min-h-0 w-full gap-2 px-8 py-[14px] font-bebas text-lg tracking-wider sm:mx-auto sm:w-auto sm:min-w-[260px] sm:max-w-[360px] sm:text-xl'

  // Dashboard after login
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 md:gap-10 px-4 py-4 sm:px-6 sm:py-6">
        {/* HERO — primary CTA first */}
        <section className="min-w-0 space-y-4 sm:space-y-5">
          <div className="text-center sm:text-left">
            <h1
              className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl"
              style={{ fontFamily: 'var(--font-bebas-neue), sans-serif', letterSpacing: '0.05em' }}
            >
              <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent">
                DECLEANUP
              </span>{' '}
              <span className="text-foreground">REWARDS</span>
            </h1>
            <p className="mt-2 font-sans text-sm text-muted-foreground sm:text-base">
              Log cleanups. Build your record. Earn rewards.
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            {canHeroSubmit && !heroMaxLevelLocked && (
              <Button
                asChild
                className={`${heroCtaClass} inline-flex bg-brand-green text-black hover:bg-brand-green/90`}
              >
                <Link href="/cleanup" className="inline-flex items-center justify-center">
                  <Leaf className="h-5 w-5 shrink-0" />
                  SUBMIT CLEANUP
                </Link>
              </Button>
            )}
            {heroMaxLevelLocked && !showHeroClaimCta && !showHeroUnderReview && (
              <p className="max-w-md text-center text-sm text-muted-foreground sm:text-left">
                You&apos;re at the maximum Impact Product level — new submissions are closed for this program phase.
              </p>
            )}
            {showHeroClaimCta && (
              <Button
                type="button"
                onClick={() => void handleClaimImpactLevel()}
                disabled={isClaiming}
                className={`${heroCtaClass} inline-flex bg-brand-yellow text-black hover:bg-brand-yellow/90 disabled:opacity-70`}
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                    CLAIMING…
                  </>
                ) : (
                  <>
                    <Award className="h-5 w-5 shrink-0" />
                    CLAIM LEVEL
                  </>
                )}
              </Button>
            )}
            {showHeroUnderReview && (
              <div
                className={`${heroCtaClass} inline-flex cursor-default select-none items-center justify-center border border-brand-green/45 bg-brand-green/10 text-brand-green`}
                role="status"
                aria-live="polite"
              >
                <Clock className="h-5 w-5 shrink-0" aria-hidden />
                UNDER REVIEW
              </div>
            )}
            {showHeroUnderReview ? (
              <p className="max-w-md text-center text-xs text-muted-foreground sm:text-sm">
                Your cleanup is being verified. This usually takes a few hours.
              </p>
            ) : null}
          </div>
        </section>

        {/* Referral notification — right after hero */}
        {showReferralNotification && referrerAddress && (
          <div className="rounded-lg border-2 border-brand-green bg-brand-green/10 p-4 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Users className="h-5 w-5 text-brand-green" />
              </div>
              <div className="flex-1">
                <ReferralInviteMessage
                  afterRewards={
                    <div className="mt-3 flex gap-2">
                      <Link href="/cleanup">
                        <Button className="bg-brand-green text-black hover:bg-[#4a9a26]">Submit Your First Cleanup</Button>
                      </Link>
                    </div>
                  }
                />
              </div>
              <button
                onClick={() => {
                  setShowReferralNotification(false)
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

        <section className="flex flex-col gap-4 lg:gap-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
          {impactProduct.level > 0 ? (
            <DashboardImpactProduct
              className="lg:h-full"
              level={impactProduct.level}
              imageUrl={impactProduct.imageUrl}
              animationUrl={impactProduct.animationUrl}
              tokenId={impactProduct.tokenId}
              contractAddress={CONTRACT_ADDRESSES.IMPACT_PRODUCT || ''}
              metadataName={impactProduct.metadataName}
              metadataDescription={impactProduct.metadataDescription}
              metadataExternalUrl={impactProduct.metadataExternalUrl}
              metadataAttributes={impactProduct.metadataAttributes}
              verifiedCleanupsCount={hasLoadedDashboardOnce ? rewardStats.verifiedCleanupsCount : null}
            />
          ) : cleanupStatus?.canClaim ? (
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-brand-yellow/30 bg-card p-5 sm:p-8 lg:h-full">
              <SectionHeading icon={Award}>Your Impact Product level</SectionHeading>
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-4 w-full max-w-md rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
                  <p className="text-sm sm:text-base text-brand-yellow">
                    Your cleanup is verified! Claim your Impact Product (level {cleanupStatus.level ?? 1}) using the yellow
                    button in the section above to mint and unlock rewards.
                  </p>
                </div>
                <div className="mb-4 rounded-2xl border-2 border-brand-yellow/40 bg-gradient-to-br from-brand-yellow/10 to-transparent p-8">
                  <Award className="mx-auto h-16 w-16 text-brand-yellow sm:h-20 sm:w-20" />
                </div>
                <h3 className="mb-2 font-bebas text-2xl tracking-wider text-foreground sm:text-3xl">Ready to claim</h3>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-5 sm:p-8 lg:h-full">
              <SectionHeading icon={Award}>Your Impact Product level</SectionHeading>
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-4 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand-green/5 to-transparent p-8 sm:p-12">
                  <Award className="mx-auto h-16 w-16 text-muted-foreground/50 sm:h-20 sm:w-20" />
                </div>
                <h3 className="mb-2 font-bebas text-2xl sm:text-3xl tracking-wider text-foreground">Not minted yet</h3>
                <p className="max-w-xs text-sm text-muted-foreground sm:text-base">
                  Submit your first cleanup to mint your Impact Product. Use <span className="text-foreground">Submit cleanup</span>{' '}
                  at the top of the page to begin.
                </p>
              </div>
            </div>
          )}
            </div>
            <aside className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <SectionHeading icon={TrendingUp}>Profile and Rewards</SectionHeading>
                {isRewardIdentityVerifier ? (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => setShowVerifierRulesModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/45 bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-green transition-colors hover:bg-brand-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Verifier
                    </button>
                  </div>
                ) : null}
                <p
                  className={cn(
                    'mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm',
                    !isRewardIdentityVerifier && '-mt-1'
                  )}
                >
                  Complete cleanups, build your rank and reputation, create impact profile
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {address ? (
                    <Button variant="outline" asChild className="w-full border-border font-bebas tracking-wide sm:w-auto">
                      <Link
                        href={`/impact/${address}${
                          submissionOwnerAddress &&
                          submissionOwnerAddress.toLowerCase() !== address.toLowerCase()
                            ? `?sa=${submissionOwnerAddress}`
                            : ''
                        }`}
                        className="inline-flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                        Impact portfolio
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {cleanupStatus?.canClaim && claimFeeInfo && claimFeeInfo.enabled && claimFeeInfo.fee > 0n ? (
                  <div className="mt-3">
                    <FeeDisplay feeAmount={claimFeeInfo.fee} feeSymbol="CELO" type="claim" className="mt-1" />
                  </div>
                ) : null}
              </div>

              {submissionOwnerAddress ? (
                <DashboardReferralLinkCard
                  title="Invite Friends"
                  submissionOwnerAddress={submissionOwnerAddress}
                  impactLevel={impactProduct.level > 0 ? impactProduct.level : 1}
                  onNotify={(p) => setNotifyModal({ title: p.title, message: p.message, variant: p.variant || 'info' })}
                />
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-4 sm:p-5">
                <SectionHeading icon={TrendingUp}>REWARDS</SectionHeading>
                <div className="mb-3 mt-2 grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-brand-green/30 bg-brand-green/5 p-3 sm:p-4">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="text-[11px] font-sans font-semibold uppercase tracking-wide text-muted-foreground">
                        Total DCU
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEarnModal(true)}
                        className="inline-flex rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50"
                        aria-label="About DCU points, $cDCU, eligibility, and how to earn more"
                      >
                        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </button>
                    </div>
                    <p className="font-bebas text-2xl leading-none text-brand-green sm:text-3xl">
                      {!hasLoadedDashboardOnce ? (
                        <Loader2 className="h-7 w-7 animate-spin text-brand-green/80" aria-hidden />
                      ) : (
                        rewardStats.totalEarnedDCU.toFixed(0)
                      )}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Total network points from all activities</p>
                  </div>
                  {address && submissionOwnerAddress ? (
                    <div className="min-w-0 w-full">
                      <DashboardClaimCdcu rewardAddress={submissionOwnerAddress} payoutAddress={address} />
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-border/50 bg-background/30 p-2.5 text-left hover:bg-background/50 sm:p-3"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Breakdown</span>
                  {showBreakdown ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </div>
            </aside>
          </div>

          {showBreakdown ? (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-4 rounded-xl border border-border/80 bg-background/40 p-3 sm:p-4">
                <h3 className="font-bebas text-lg tracking-wider text-foreground sm:text-xl">Impact Product level</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Level {hasLoadedDashboardOnce ? rewardStats.userLevel : '-'} of {MAX_IMPACT_PRODUCT_LEVEL}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-brand-green transition-all"
                    style={{
                      width: `${hasLoadedDashboardOnce
                        ? Math.min(100, (rewardStats.userLevel / MAX_IMPACT_PRODUCT_LEVEL) * 100)
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
              {hasLoadedDashboardOnce &&
                rewardStats.verifiedCleanupsCount > 0 &&
                rewardStats.cleanupsDCU === 0 && (
                  <p className="mb-3 rounded-lg border border-border/80 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    You have {rewardStats.verifiedCleanupsCount} verified cleanup
                    {rewardStats.verifiedCleanupsCount === 1 ? '' : 's'} on-chain, but &quot;Impact level DCU&quot; is still
                    0. That bucket fills when you claim Impact Product levels after verification (and only if the
                    deployed NFT has impact rewards enabled). Other rows (reports, recyclables, etc.) can still show
                    DCU from their own contracts.
                  </p>
                )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[
                  {
                    label: 'Cleanups',
                    value: rewardStats.cleanupsDCU.toFixed(0),
                    showToken: true,
                  },
                  {
                    label: 'Referrals',
                    value: rewardStats.referralsDCU.toFixed(0),
                    showToken: true,
                  },
                  { label: 'Streak', value: rewardStats.streakDCU.toFixed(0), showToken: true },
                  {
                    label: 'Impact reports',
                    value: rewardStats.reportsDCU.toFixed(0),
                    showToken: true,
                  },
                  {
                    label: 'Recyclables',
                    value: rewardStats.recyclablesDCU.toFixed(0),
                    showToken: true,
                  },
                  {
                    label: 'Hypercerts (impact certificates)',
                    value: rewardStats.hypercertsDCU.toFixed(0),
                    showToken: true,
                  },
                  { label: 'Verifier', value: rewardStats.verifierDCU.toFixed(0), showToken: true },
                  {
                    label: 'Contributed cleanups',
                    value: String(rewardStats.contributorCleanupCount),
                    showToken: false,
                    suffix: ' cleanups',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-background/50 p-3 transition-all hover:border-brand-green/50 hover:bg-background sm:p-3.5"
                  >
                    <div className="mb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </span>
                    </div>
                    <p className="font-bebas text-xl leading-none text-foreground sm:text-2xl">
                      {!hasLoadedDashboardOnce ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                      ) : (
                        <span>
                          {stat.value}
                          {stat.showToken ? ' DCU' : `${'suffix' in stat && stat.suffix ? stat.suffix : ''}`}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {!isRewardIdentityVerifier ? <VerifierApplyCard /> : null}

        {hypercertEligibility?.isEligible && (
          <div className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
            <Heart className="mb-2 h-5 w-5 text-brand-yellow" aria-hidden />
            <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">
              Hypercert
              {hypercertEligibility.testingOverride && (
                <span className="ml-2 text-xs font-normal text-brand-yellow/70">(Sepolia Testnet)</span>
              )}
            </h3>
            <Link href="/hypercerts" className="block">
              <Button
                size="sm"
                className="h-8 w-full gap-1 bg-brand-yellow text-xs text-black hover:bg-brand-yellow/90"
              >
                <Heart className="h-3 w-3" />
                Open Hypercerts certification
              </Button>
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground">Minting runs from approved requests in the certification panel.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div className="min-w-0">
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

        <div className="mt-2 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:mt-4">
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
              <p className="text-xs text-muted-foreground">Impact certification</p>
            </div>
          </Link>
        </div>
      </main>

      {claimModal && (
        <AlertModal
          isOpen
          onClose={() => {
            if (claimModal.variant === 'success') {
              if (claimSuccessHandledRef.current) return
              claimSuccessHandledRef.current = true
              setClaimModal(null)
              void claimRefreshAfterModalRef.current?.()
              claimRefreshAfterModalRef.current = null
            } else {
              setClaimModal(null)
            }
          }}
          title={
            claimModal.title ??
            (claimModal.variant === 'success' ? 'Impact Product claimed' : 'Claim failed')
          }
          message={claimModal.message}
          variant={claimModal.variant}
          autoCloseMs={claimModal.variant === 'success' ? 3000 : undefined}
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

      {showVerifierRulesModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verifier-rules-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="verifier-rules-title" className="font-bebas text-2xl tracking-wider text-foreground">
                Verifier guidelines
              </h2>
              <button
                type="button"
                onClick={() => setShowVerifierRulesModal(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              New verifier applicants need Impact Product level{' '}
              <strong className="text-foreground">{VERIFIER_CONFIG.requirements.minLevel}</strong>, at least{' '}
              <strong className="text-foreground">{VERIFIER_CONFIG.requirements.minDCUBalance}</strong> DCU, and{' '}
              <strong className="text-foreground">{VERIFIER_CONFIG.requirements.minApprovedCleanups}</strong> verified
              cleanups. Once you review, follow these rules every time:
            </p>
            <ul className="mb-6 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-brand-green" aria-hidden>
                  •
                </span>
                <span>Review submissions fairly, using the photo evidence as the source of truth.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-green" aria-hidden>
                  •
                </span>
                <span>Check that written reports match what the photos actually show.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-green" aria-hidden>
                  •
                </span>
                <span>Approve only legitimate cleanups; reject ones that look wrong, staged, or incomplete.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-green" aria-hidden>
                  •
                </span>
                <span>Do not review your own submissions.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-green" aria-hidden>
                  •
                </span>
                <span>The team may audit decisions and penalize misuse.</span>
              </li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" asChild className="font-bebas tracking-wide">
                <Link href="/verifier">Open verifier tools</Link>
              </Button>
              <Button
                type="button"
                onClick={() => setShowVerifierRulesModal(false)}
                className="bg-brand-green font-bebas uppercase tracking-wide text-black hover:bg-brand-green/90"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="font-bebas text-2xl tracking-wider text-foreground uppercase">
                DCU points &amp; how to earn more
              </h2>
              <button
                type="button"
                onClick={() => setShowEarnModal(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 space-y-3 rounded-lg border border-border bg-background/80 p-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">What is DCU?</strong> DCU (DeCleanup Units) are participation points you
                earn on-chain for cleanups, referrals, streaks, reports, verification work, Hypercerts, and similar activity.
              </p>
              <p>
                <strong className="text-foreground">Converting to $cDCU.</strong> Every{' '}
                <strong className="text-foreground">50 DCU</strong> slice can unlock a claim: use{' '}
                <strong className="text-foreground">Claim $cDCU</strong> on the dashboard to request a signed mint and confirm
                in your wallet. How much $cDCU you mint per slice can grow with your activity (multiplier). If the card says
                you still need DCU, keep contributing until the next threshold.
              </p>
              <p>
                <strong className="text-foreground">Claims.</strong> You also need an active Claim Vault and token on this
                network, and no conflicting pending claim for your address. Exact amounts follow the live eligibility check and
                contracts.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">1. Impact Products</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">10 DCU</strong> per level by submitting before-and-after cleanup
                  photos and passing verification. Ten levels are live today; more may follow.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">2. Referrals</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">3 DCU</strong> when someone joins through your link and completes a
                  verified cleanup.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">3. Streaks</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">3 DCU</strong> per streak level by submitting at least one cleanup
                  each calendar week.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">4. Reports &amp; recyclables</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">5 DCU</strong> for each verified impact report or recyclables
                  submission tied to a cleanup.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">5. Verifier work</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">1 DCU</strong> per submission you review—approved or rejected with
                  a clear reason—once you are an active verifier.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">6. Impact certificates (Hypercerts)</h3>
                <p className="text-sm text-muted-foreground">
                  Earn <strong className="text-foreground">10 DCU</strong> for every ten verified cleanups when you create a
                  Hypercert (impact certificate).
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowEarnModal(false)}
              className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      <section
        aria-label="$cDCU airdrop for past contributors"
        className="w-full border-t border-brand-green/25 bg-brand-green/10 py-5 sm:py-6"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-stretch gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-center font-sans text-sm leading-relaxed text-muted-foreground sm:text-left sm:max-w-xl">
            Past contributor? You may qualify for the $cDCU airdrop.
          </p>
          <Button
            asChild
            className="w-full shrink-0 bg-brand-green font-bebas text-sm uppercase tracking-wider text-black hover:bg-brand-green/90 sm:w-auto sm:min-w-[11rem]"
          >
            <Link href="/airdrop">Claim airdrop</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 mt-0 flex-shrink-0">
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

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <Link href="/guide" className="font-normal hover:text-brand-green transition-colors">
                User Guide
              </Link>
              <Link href="/terms" className="font-normal hover:text-brand-green transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="font-normal hover:text-brand-green transition-colors">
                Privacy Policy
              </Link>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest opacity-40 select-none sm:text-sm">
              <span className="font-sans font-medium">Built on</span>
              <img
                src="/celo-celo-logo.svg"
                alt="Celo"
                className="h-5 w-auto rounded-sm sm:h-6"
              />
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
