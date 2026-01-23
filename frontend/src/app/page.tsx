'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAccount, useChainId } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import { Leaf, Award, Users, Share2, Copy, Heart, TrendingUp, Flame, Info, FileText, Shield, Trophy, CheckSquare, Loader2, X } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { claimImpactProductFromVerification, getHypercertEligibility, getDCUBalance, getUserRewardStats, getUserLevel, getUserTokenId, getTokenURI, getTokenURIForLevel, getUserSubmissions, getCleanupDetails, getClaimFee } from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'
import { getCrecyBalance } from '@/lib/utils/crecy-tracking'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { useIsVerifier } from '@/hooks/useIsVerifier'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { markCleanupAsClaimed, clearPendingCleanup } from '@/lib/blockchain/verification'
import { resetCleanupState, resetAllCleanupState } from '@/lib/utils/reset-cleanup'
import { generateReferralLink } from '@/lib/utils/sharing'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
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
      console.log('Reset functions available:')
      console.log('  window.resetCleanup(cleanupId?) - reset cleanup state')
      console.log('  window.clearPreFixCleanup(cleanupId) - clear pre-fix cleanup (e.g., cleanup #3)')
      console.log('  Example: window.resetCleanup(3) - reset cleanup #3')
      console.log('  Example: window.clearPreFixCleanup(3) - clear pre-fix cleanup #3')
    }
  }, [address])
  const chainId = useChainId()
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
  const [crecyBalance, setCrecyBalance] = useState<number>(0)
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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle referral link detection - ONLY show notification if user was actually referred (check contract)
  useEffect(() => {
    if (!mounted || !address || !isConnected) return

    const checkReferral = async () => {
      try {
        // First, check if user was actually referred by checking the contract
        const { getUserReferrer } = await import('@/lib/blockchain/contracts')
        const contractReferrer = await getUserReferrer(address)
        
        if (contractReferrer) {
          // User was actually referred - check if they've already submitted
          const submissions = await getUserSubmissions(address)
          const hasSubmitted = submissions.length > 0
          
          // Also check if they have a pending cleanup (submitted but not yet verified/claimed)
          const currentStatus = await getUserCleanupStatus(address)
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
          const submissions = await getUserSubmissions(address)
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
  }, [mounted, address, isConnected, searchParams])

  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      setHypercertEligibility(null)
      return
    }

    async function checkStatus() {
      if (!address) return
      try {
        // Calculate verified cleanups and reports
        const submissions = await getUserSubmissions(address)
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
        const eligibilityResult = checkHypercertEligibility({ cleanupsCount: verifiedCleanupsCount, reportsCount: impactReportsCount })
        const eligibility = {
          isEligible: eligibilityResult.eligible,
          cleanupCount: eligibilityResult.cleanupsCount,
          hypercertCount: 0, // for now, not using
          testingOverride: eligibilityResult.testingOverride
        }

        const [status, balance, rewardStatsData, level, tokenId, feeInfo] = await Promise.all([
          getUserCleanupStatus(address),
          getDCUBalance(address),
          getUserRewardStats(address),
          getUserLevel(address),
          getUserTokenId(address),
          getClaimFee(),
        ])
        setClaimFeeInfo(feeInfo)
        // Only update cleanup status if it's different from current state
        // This prevents re-showing claim button after it's been hidden
        console.log('[Home] Cleanup status from getUserCleanupStatus:', status)
        if (status) {
          console.log('[Home] Setting cleanup status:', {
            hasPendingCleanup: status.hasPendingCleanup,
            canSubmit: status.canSubmit,
            canClaim: status.canClaim,
            cleanupId: status.cleanupId?.toString(),
            level: status.level,
            reason: status.reason,
          })
          setCleanupStatus(status)
        } else {
          // If no status, clear it (no claimable cleanup)
          console.log('[Home] No cleanup status - clearing')
          setCleanupStatus(null)
        }
        setHypercertEligibility(eligibility)
        setDcuBalance(balance)
        
        // Calculate breakdown from reward stats
        // Cleanups DCU = claimRewardsAmount (10 $cDCU per cleanup when NFT is claimed)
        // This represents completed cleanup cycles: submit → verify → claim NFT
        // The 10 $cDCU is distributed when user claims their Impact Product NFT level
        const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
        // Calculate cleanup count from DCU amount (10 $cDCU per cleanup/level)
        const cleanupsCount = Math.floor(cleanupsDCU / 10)
        // Referrals DCU
        const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
        // Streak DCU
        const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
        // Reports DCU (Enhanced Impact Reports)
        const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
        
        // Debug: Log reward stats to help diagnose issues
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
        
        // Note: If cleanupsDCU is 0 but user has verified cleanups, they need to claim their NFT
        if (cleanupsDCU === 0 && address) {
          try {
            const submissions = await getUserSubmissions(address)
            const verifiedCount = await Promise.all(
              submissions.map(async (id) => {
                try {
                  const details = await getCleanupDetails(id)
                  return details.verified && !details.rejected ? 1 : 0
                } catch {
                  return 0
                }
              })
            ).then(results => results.reduce((a: number, b: number) => a + b, 0))
            
            if (verifiedCount > 0) {
              console.log(`[Reward Stats] User has ${verifiedCount} verified cleanup(s) but cleanupsDCU is 0`)
              console.log('[Reward Stats] This means the cleanup was verified but NFT hasn\'t been claimed yet')
              console.log('[Reward Stats] Claim your NFT level to receive the 10 $cDCU cleanup reward')
            }
          } catch (error) {
            // Ignore
          }
        }
        
        // Check if user was referred (for referral rewards debugging)
        if (referralsDCU === 0 && address) {
          try {
            const { getUserReferrer } = await import('@/lib/blockchain/contracts')
            const referrer = await getUserReferrer(address)
            if (referrer) {
              console.log('[Reward Stats] User was referred by:', referrer, 'but referral rewards are 0')
              console.log('[Reward Stats] When you claim your first NFT level, both you and your referrer will earn 3 $cDCU each as referral rewards')
              console.log('[Reward Stats] You will also receive 10 $cDCU for claiming your first level')
              console.log('[Reward Stats] Total for invitee: 13 $cDCU (10 for level + 3 referral bonus), Referrer: 3 $cDCU')
            }
          } catch (error) {
            console.warn('[Reward Stats] Could not check referrer:', error)
          }
        }
        
        // Check if user has impact forms (for impact report rewards debugging)
        if (reportsDCU === 0 && address) {
          try {
            const submissions = await getUserSubmissions(address)
            if (submissions.length > 0) {
              // Check the first submission for impact form
              const firstSubmission = await getCleanupDetails(submissions[0])
              if (firstSubmission.hasImpactForm) {
                console.log('[Reward Stats] User has impact form in submission', submissions[0].toString(), 'but impact report rewards are 0')
                console.log('[Reward Stats] Impact report rewards should be distributed when cleanup is verified')
              }
            }
          } catch (error) {
            console.warn('[Reward Stats] Could not check impact forms:', error)
          }
        }
        // Hypercerts DCU (10 per hypercert, calculate from count)
        const hypercertsDCU = eligibility ? Number(eligibility.hypercertCount) * 10 : 0
        
        // Get verifier rewards count (1 $cDCU per verification)
        const { getVerifierRewardsCount } = await import('@/lib/blockchain/contracts')
        const verifierCount = await getVerifierRewardsCount(address as Address)
        const verifierDCU = verifierCount
        
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
        })
        
        // Fetch Impact Product NFT data
        if (level > 0) {
          try {
            let tokenURI = ''
            let imageUrl = ''
            let animationUrl = ''
            let impactValue: string | null = null
            let dcuReward: string | null = null

            // Try to get token URI from NFT contract if tokenId exists
            if (tokenId !== null) {
              tokenURI = await getTokenURI(tokenId)
            }
            
            // Fallback to level-based metadata if no token URI
            if (!tokenURI) {
              tokenURI = await getTokenURIForLevel(level)
            }

            const convertIPFSToGateway = (ipfsUrl: string) => {
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

            const fetchWithFallback = async (ipfsUrl: string): Promise<Response> => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return fetch(ipfsUrl)
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
                  const response = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
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

            if (tokenURI) {
              try {
                const metadataResponse = await fetchWithFallback(tokenURI)
                if (metadataResponse.ok) {
                  const metadata = (await metadataResponse.json()) as ImpactMetadata
                  
                  // Extract impact stats from metadata attributes
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

            // If imageUrl is still empty after metadata fetch, use IPFS fallback
            const finalImageUrl = imageUrl || (level > 0 ? (() => {
              const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
              const imageName = level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`
              return `${gateway}${imagesCID}/${imageName}`
            })() : '')
            
            const finalAnimationUrl = animationUrl || (level === 10 ? (() => {
              const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
              return `${gateway}${imagesCID}/IP10VIdeo.mp4`
            })() : '')

            setImpactProduct({
              level,
              imageUrl: finalImageUrl,
              animationUrl: finalAnimationUrl,
              tokenId,
              impactValue,
              dcuReward,
            })
          } catch (error) {
            console.error('Error fetching Impact Product data:', error)
            // Even on error, try to use IPFS fallback for image
            const fallbackImageUrl = level > 0 ? (() => {
              const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
              const imageName = level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`
              return `${gateway}${imagesCID}/${imageName}`
            })() : ''
            const fallbackAnimationUrl = level === 10 ? (() => {
              const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
              return `${gateway}${imagesCID}/IP10VIdeo.mp4`
            })() : ''
            setImpactProduct({
              level,
              imageUrl: fallbackImageUrl,
              animationUrl: fallbackAnimationUrl,
              tokenId,
              impactValue: null,
              dcuReward: null,
            })
          }
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
        
        // Get cRECY balance from localStorage (testing)
        const crecy = getCrecyBalance(address)
        setCrecyBalance(crecy)
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }

    checkStatus()
    
    // Poll for status updates every 10 seconds to catch verification changes
    const interval = setInterval(checkStatus, 10000)
    
    return () => clearInterval(interval)
  }, [mounted, isConnected, address])

  const handleMintHypercert = async () => {
    if (!address || !hypercertEligibility?.isEligible) return

    setMintingHypercert(true)
    try {
      const hypercertNumber = Number(hypercertEligibility.hypercertCount) + 1

      const result = await mintHypercert(address, hypercertNumber)

      const message =
        `✅ Hypercert eligibility registered successfully!\n\n` +
        `Transaction: ${result.txHash}\n` +
        `Hypercert ID: ${result.hypercertId}\n` +
        `Owner: ${result.owner}\n\n` +
        `ℹ️ Hypercert metadata & claiming will be enabled in a future milestone.`

      alert(message)

      // Recalculate eligibility
      const submissions = await getUserSubmissions(address)
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
      const eligibilityResult = checkHypercertEligibility({ cleanupsCount: verifiedCleanupsCount, reportsCount: impactReportsCount })
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

      alert(`❌ Failed to mint hypercert:\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`)
    } finally {
      setMintingHypercert(false)
    }
  }

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  // Simple hero before login
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-3xl space-y-8 text-center">
            {/* Hero Heading */}
            <div className="space-y-4">
              <h1 className="font-bebas text-5xl font-bold leading-none tracking-wider text-white sm:text-6xl md:text-7xl lg:text-8xl">
                DECLEANUP REWARDS
              </h1>
              <p className="font-bebas text-xl tracking-wide text-brand-green sm:text-2xl md:text-3xl">
                Self-tokenize environmental cleanup efforts
              </p>
            </div>

            {/* Description */}
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              Apply with your cleanup results to receive a DeCleanup Impact Product, earn community token $cDCU, and progress through levels.
            </p>

            {/* Log In Button */}
            <div className="pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Connect your wallet to get started
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:gap-6 sm:text-sm">
              <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                GITHUB
              </a>
              <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                LITEPAPER
              </a>
              <a href="https://x.com/decleanupnet" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                X
              </a>
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase">Built on</span>
                <div className="flex h-6 items-center justify-center rounded bg-muted px-2 font-bold uppercase text-foreground">
                  CELO
                </div>
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
        {/* Header Section */}
        <div className="flex items-center justify-between flex-shrink-0 mb-2">
          <div>
            <h1 className="font-bebas text-3xl sm:text-4xl lg:text-5xl tracking-wider text-foreground">
              DASHBOARD
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">
              Track your impact and earnings
            </p>
          </div>
          <button
            onClick={() => setShowEarnModal(true)}
            className="flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-green/10 px-3 py-2 sm:px-4 sm:py-2.5 text-brand-green hover:bg-brand-green/20 transition-colors"
            title="Learn how to earn more $cDCU"
          >
            <Info className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-bebas text-sm tracking-wide hidden sm:inline">HOW TO EARN</span>
          </button>
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
                  You've been referred to DeCleanup Rewards! When you submit your first cleanup, get it verified, and claim your first Impact Product level, both you and your referrer will earn <strong className="text-white">3 $cDCU</strong> each as referral rewards. Additionally, you'll receive <strong className="text-white">10 $cDCU</strong> for claiming your first level (separate from referral rewards).
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
            />
          ) : (
            <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8 min-h-[400px] sm:min-h-[500px]">
              <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                <Award className="h-5 w-5 text-brand-yellow" />
                <h2 className="font-bebas text-xl sm:text-2xl tracking-wider text-foreground">
                  IMPACT PRODUCT
                </h2>
              </div>

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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Stats Section */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-2">
            {/* Stats Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-brand-green" />
                <h2 className="font-bebas text-xl tracking-wider text-foreground">
                YOUR STATS
              </h2>
              </div>
              
              {/* Total Balances - Always Visible */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="group rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 hover:border-brand-green/50 hover:bg-brand-green/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-sans font-semibold text-muted-foreground tracking-wide">Total $cDCU</span>
                    <TrendingUp className="h-4 w-4 text-brand-green transition-transform group-hover:scale-110" />
                  </div>
                  <p className="font-bebas text-3xl text-brand-green leading-none">
                    {parseFloat(formatEther(dcuBalance)).toFixed(0)}
                  </p>
                </div>
                
                <div className="group rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 hover:border-brand-green/50 hover:bg-brand-green/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-sans font-semibold text-muted-foreground tracking-wide">Total $cRECY</span>
                    <TrendingUp className="h-4 w-4 text-brand-green transition-transform group-hover:scale-110" />
                  </div>
                  <p className="font-bebas text-3xl text-brand-green leading-none">
                    {crecyBalance.toFixed(2)}
                  </p>
                </div>
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
                    { label: 'Cleanups', icon: TrendingUp, value: rewardStats.cleanupsDCU.toFixed(0), color: 'text-brand-green', showToken: true, count: rewardStats.cleanupsCount.toString() },
                    { label: 'Referrals', icon: Users, value: rewardStats.referralsDCU.toFixed(0), color: 'text-brand-green', showToken: true },
                    { label: 'Streak', icon: Flame, value: rewardStats.streakDCU.toFixed(0), color: 'text-brand-yellow', showToken: true },
                    { label: 'Reports', icon: FileText, value: rewardStats.reportsDCU.toFixed(0), color: 'text-brand-green', showToken: true },
                    { label: 'Hypercerts', icon: Heart, value: rewardStats.hypercertsDCU.toFixed(0), color: 'text-brand-green', showToken: true, count: hypercertEligibility ? Number(hypercertEligibility.hypercertCount).toString() : '0' },
                    { label: 'Verifier', icon: Shield, value: rewardStats.verifierDCU.toFixed(0), color: isVerifierUser ? 'text-brand-green' : 'text-muted-foreground', showToken: true },
                  ].map((stat) => {
                    const IconComponent = stat.icon
                    return (
                      <div key={stat.label} className="group rounded-xl border border-border bg-background/50 p-4 hover:border-brand-green/50 hover:bg-background transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {stat.label}
                            {stat.count && ` (${stat.count})`}
                          </span>
                          <IconComponent className={`h-4 w-4 ${stat.color} transition-transform group-hover:scale-110`} />
                        </div>
                        <p className="font-bebas text-2xl text-foreground leading-none">
                          {stat.value}{stat.showToken ? ' $cDCU' : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className={`grid gap-3 ${chainId === 44787 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <Link href="/leaderboard" className="block">
                <div className="rounded-xl border border-border bg-card p-4 hover:border-brand-green/50 transition-all group">
                  <Trophy className="h-5 w-5 text-brand-yellow mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bebas text-sm tracking-wider text-foreground mb-1">
                    LEADERBOARD
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Top contributors
                  </p>
                </div>
              </Link>

              {isConnected && (
                <Link href="/verifier" className="block">
                  <div className="rounded-xl border border-border bg-card p-4 hover:border-brand-green/50 transition-all group">
                    <CheckSquare className="h-5 w-5 text-brand-green mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bebas text-sm tracking-wider text-foreground mb-1">
                      VERIFIER CABINET
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Verify cleanups
                </p>
              </div>
            </Link>
              )}

              {chainId === 44787 && (
                <Link href="/hypercerts" className="block">
                  <div className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4 hover:border-brand-yellow/50 transition-all group">
                    <Heart className="h-5 w-5 text-brand-yellow mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bebas text-sm tracking-wider text-foreground mb-1">
                      HYPERCERTS TEST
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Test page
                    </p>
                  </div>
                </Link>
              )}

            {hypercertEligibility?.isEligible && (
                <div className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
                  <Heart className="h-5 w-5 text-brand-yellow mb-2" />
                  <h3 className="font-bebas text-sm tracking-wider text-foreground mb-1">
                    HYPERCERT
                    {hypercertEligibility.testingOverride && (
                      <span className="ml-2 text-xs text-brand-yellow/70 font-normal">(Sepolia Testnet)</span>
                    )}
                  </h3>
                <Button
                  onClick={handleMintHypercert}
                  disabled={mintingHypercert}
                    size="sm"
                    className="w-full gap-1 bg-brand-yellow text-black hover:bg-brand-yellow/90 disabled:opacity-50 h-7 text-xs"
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
            )}
            </div>

            {/* Invite Friends */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-brand-green" />
                <h3 className="font-bebas text-xl tracking-wider text-foreground">
                  INVITE FRIENDS
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Earn 3 $cDCU each when friends submit, get verified, and claim their first Impact Product level.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-brand-green/30 bg-brand-green/5 px-3 py-2 h-auto text-xs font-bebas tracking-wider text-brand-green hover:bg-brand-green/10 hover:border-brand-green/50"
                  onClick={() => {
                    if (!address) return
                    const { generateReferralLink } = require('@/lib/utils/sharing')
                    const link = generateReferralLink(address)
                    const message = `Join me in @decleanupnet Rewards 🌍

Clean up, prove impact, earn Impact Products, build reputation, and soon vote on global cleanup decisions in the Celo app.

🔗 ${link}`
                    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`, '_blank')
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Farcaster
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border px-3 py-2 h-auto text-xs font-bebas tracking-wider hover:bg-accent"
                  onClick={() => {
                    if (!address) return
                    const link = generateReferralLink(address)
                    const message = `Join me in @decleanupnet Rewards 🌍

Clean up, prove impact, earn Impact Products, build reputation, and soon vote on global cleanup decisions in the Celo app.

🔗 ${link}`
                    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
                    window.open(xUrl, '_blank')
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border px-3 py-2 h-auto text-xs font-bebas tracking-wider hover:bg-accent"
                  onClick={async () => {
                    if (!address) return
                    const link = generateReferralLink(address)
                    const message = `Join me in @decleanupnet Rewards 🌍

Clean up, prove impact, earn Impact Products, build reputation, and soon vote on global cleanup decisions in the Celo app.

🔗 ${link}`
                    try {
                      await navigator.clipboard.writeText(message)
                      alert('Referral link copied to clipboard!')
                    } catch (error) {
                      // Fallback: try to copy just the link
                      try {
                        await navigator.clipboard.writeText(link)
                        alert('Referral link copied!')
                      } catch (err) {
                        alert(`Referral link: ${link}`)
                      }
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex flex-col lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 flex-1 overflow-auto">
              {/* Action Buttons - Use DashboardActions for proper state management */}
              <div className="flex-shrink-0">
                <DashboardActions
                  address={address || ''}
                  cleanupStatus={cleanupStatus || null}
                  claimFeeInfo={claimFeeInfo}
                  onClaim={async () => {
                    // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
                    if (cleanupStatus?.cleanupId === undefined || cleanupStatus?.cleanupId === null || isClaiming) {
                      console.warn('[Home] Claim blocked:', {
                        cleanupId: cleanupStatus?.cleanupId?.toString(),
                        isClaiming,
                      })
                      return
                    }
                  
                    try {
                      setIsClaiming(true)
                  
                      await claimImpactProductFromVerification(cleanupStatus.cleanupId)

                      // Mark as claimed in localStorage IMMEDIATELY after successful claim
                      if (address && cleanupStatus.cleanupId !== undefined && cleanupStatus.cleanupId !== null) {
                        console.log('[Home] Marking cleanup as claimed:', cleanupStatus.cleanupId.toString())
                        markCleanupAsClaimed(address as Address, cleanupStatus.cleanupId)
                        // Verify it was marked
                        const claimedKey = `claimed_cleanup_ids_${address.toLowerCase()}`
                        const claimedIds = localStorage.getItem(claimedKey)
                        console.log('[Home] Claimed cleanups after marking:', claimedIds)
                        
                        // Also clear pending cleanup from localStorage since it's now claimed
                        const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
                        localStorage.removeItem(pendingKey)
                        localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                        console.log('[Home] Cleared pending cleanup from localStorage')
                      }

                      alert(
                        `✅ Claim submitted!\n\n` +
                        `Your claim transaction was sent.\n\n` +
                        `Please wait for confirmation and refresh the page in a moment.`
                      )
                  
                      // Immediately update state to reflect claimed status (optimistic update)
                      // This ensures UI updates right away without waiting for RPC
                      // Set to null to prevent claim button from appearing
                      setCleanupStatus(null)
                  
                      // Hide referral notification after claim (user has completed submission cycle)
                      setShowReferralNotification(false)
                      
                      // Wait a bit for state to propagate before refreshing from contract
                      await new Promise(resolve => setTimeout(resolve, 5000))
                  
                      // Refresh status and reward stats from contract to get latest state
                      // After claiming, the cleanup should be marked as claimed, so status should be null
                      if (address) {
                        console.log('[Home] Refreshing cleanup status and reward stats after claim...')
                        const status = await getUserCleanupStatus(address as Address)
                        console.log('[Home] New cleanup status after claim:', status)
                        // After claiming, status should be null or canClaim should be false
                        // This prevents showing claim button for other cleanups immediately after claiming
                        setCleanupStatus(status)

                        // Recalculate eligibility
                        const submissions = await getUserSubmissions(address)
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
                        const eligibilityResult = checkHypercertEligibility({ cleanupsCount: verifiedCleanupsCount, reportsCount: impactReportsCount })
                        const eligibility = {
                          isEligible: eligibilityResult.eligible,
                          cleanupCount: eligibilityResult.cleanupsCount,
                          hypercertCount: 0,
                          testingOverride: eligibilityResult.testingOverride
                        }
                        setHypercertEligibility(eligibility)
                        
                        // Refresh reward stats to show updated breakdown (cleanupsDCU should now show 10)
                        console.log('[Home] Refreshing reward stats to see updated breakdown...')
                        try {
                          const [balance, rewardStatsData, level, tokenId] = await Promise.all([
                            getDCUBalance(address),
                            getUserRewardStats(address),
                            getUserLevel(address),
                            getUserTokenId(address),
                          ])
                          setDcuBalance(balance)
                          
                          // Calculate breakdown from reward stats
                          const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
                          const cleanupsCount = Math.floor(cleanupsDCU / 10)
                          const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
                          const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
                          const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
                          
                          // Calculate hypercertsDCU and verifierDCU from eligibility data
                          const hypercertsDCU = eligibility ? Number(eligibility.hypercertCount) * 10 : 0
                          
                          // Get verifier rewards count (1 $cDCU per verification)
                          const { getVerifierRewardsCount } = await import('@/lib/blockchain/contracts')
                          const verifierCount = await getVerifierRewardsCount(address as Address)
                          const verifierDCU = verifierCount
                          
                          if (process.env.NODE_ENV === 'development') {
                            console.log('[Dashboard] Verifier rewards (after claim):', {
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
                          })
                          
                          // Update Impact Product if level changed
                          if (level > 0) {
                            try {
                              const tokenURI = await getTokenURIForLevel(level)
                              const metadata = await fetch(tokenURI).then(r => r.json())
                              setImpactProduct({
                                level,
                                imageUrl: metadata.image || '',
                                animationUrl: metadata.animation_url || '',
                                tokenId: tokenId || null,
                                impactValue: metadata.attributes?.find((a: any) => a.trait_type === 'Impact Value')?.value || String(level),
                                dcuReward: null,
                              })
                            } catch (error) {
                              console.warn('[Home] Could not fetch Impact Product metadata after claim:', error)
                            }
                          }
                        } catch (error) {
                          console.error('[Home] Error refreshing reward stats after claim:', error)
                        }
                      }
                      
                      // Refresh data on current page to see updated balance and NFT
                      console.log('[Home] Refreshing data to see updated balance and NFT...')
                    } catch (error: any) {
                      console.error('Error claiming:', error)
                      const errorMessage = error?.message || String(error)
                      alert(`Failed to claim: ${errorMessage}`)
                    } finally {
                      setIsClaiming(false)
                    }
                  }}
                  isClaiming={isClaiming}
                />
                  </div>
            </div>
          </div>
              </div>

        {/* Links Section - Bottom, Spread Horizontally */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  {[
              { label: 'Website', href: 'https://decleanup.net' },
              { label: 'GitHub', href: 'https://github.com/DeCleanup-Network' },
              { label: 'Litepaper', href: 'https://decleanup.net/litepaper' },
              { label: 'Tokenomics', href: 'https://decleanup.net/tokenomics' },
              { label: 'Follow on X', href: 'https://x.com/decleanupnet' },
              { label: 'Farcaster', href: 'https://farcaster.xyz/decleanupnet' },
              { label: 'Join Community', href: 'https://t.me/decleanup' },
              { label: 'Donate on Giveth', href: 'https://giveth.io/project/decleanup-network-cleaning-the-planet-empowering-communities' },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-brand-green transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
          </div>
        </div>
      </main>

      {/* Learn More Modal */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-foreground">
                HOW TO EARN MORE $cDCU
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
                <h3 className="mb-2 font-bebas text-lg text-brand-green">1. IMPACT PRODUCT CLAIMS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 $cDCU per level by submitting before-and-after cleanup photos, waiting for verification and level upgrade. Each set of 10 cleanups mints a Hypercert and awards an additional 10 $cDCU. Currently 10 levels available, with more to come.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">2. REFERRALS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 $cDCU for each user who joins via your link, submits cleanup photos, gets it verified and claims an Impact Product.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">3. STREAKS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 $cDCU per level if you submit cleanups at least once per week to maintain your streak.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">4. ENHANCED IMPACT REPORT</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 5 $cDCU if you submit optional form after each cleanup - used to generate your onchain impact certificate Hypercert (after 10 cleanups).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">5. BECOME VERIFIER</h3>
                <p className="text-sm text-muted-foreground">
                  Stake 100 $cDCU to get access to verifier cabinet and earn 1 $cDCU per verified submission.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">6. HYPERCERT CREATION</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 $cDCU when you mint a Hypercert after completing every 10 verified cleanups. Hypercerts are onchain impact certificates that represent your environmental contributions.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowEarnModal(false)}
              className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
            >
              GOT IT
            </Button>
          </div>
        </div>
      )}
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
