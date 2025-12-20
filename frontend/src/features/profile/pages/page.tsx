import { generateReferralLink, formatImpactShareMessage, shareCast } from '@/lib/utils/sharing'
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { FeeDisplay } from '@/components/ui/fee-display'
import { BackButton } from '@/components/layout/BackButton'
import {
  Award,
  TrendingUp,
  Leaf,
  Loader2,
  Flame,
  Clock,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Share2,
  Copy,
} from 'lucide-react'
import Link from 'next/link'
import { getDCUBalance, getStakedDCU, getUserLevel, getUserTokenId, getTokenURI, getTokenURIForLevel, getStreakCount, hasActiveStreak, claimImpactProductFromVerification,} from '@/lib/blockchain/contracts'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/wagmi'
import { useChainId } from 'wagmi'
import { DashboardPersonalStats } from '@/components/dashboard/DashboardPersonalStats'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { getUserCleanupStatus, markCleanupAsClaimed } from '@/lib/blockchain/verification'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'CeloScan (Sepolia)'
  : 'CeloScan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

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

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [hasMounted, setHasMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState({
    dcuBalance: 0,
    stakedDCU: 0,
    level: 0,
    streak: 0,
    hasActiveStreak: false,
    tokenURI: '',
    imageUrl: '',
    animationUrl: '',
    metadata: null as ImpactMetadata | null,
    tokenId: null as bigint | null,
    impactValue: null as string | null,
    dcuReward: null as string | null,
  })
  const [cleanupStatus, setCleanupStatus] = useState<{
    cleanupId: bigint | null
    verified: boolean
    claimed: boolean
    level: number
    loading: boolean
  } | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copyingField, setCopyingField] = useState<string | null>(null)

  // Prevent hydration mismatch by ensuring we render only after mounting
  useEffect(() => {
    setHasMounted(true)
  }, [])

  const loadProfileData = useCallback(
    async (userAddress: Address, options?: { showSpinner?: boolean }) => {
      const showSpinner = options?.showSpinner ?? true
      try {
        if (showSpinner) {
          setLoading(true)
        }

        const [dcuBalance, stakedDCU, level, streak, activeStreak, tokenId] = await Promise.all([
          getDCUBalance(userAddress),
          getStakedDCU(userAddress),
          getUserLevel(userAddress),
          getStreakCount(userAddress),
          hasActiveStreak(userAddress),
          getUserTokenId(userAddress),
        ])

        let tokenURI = ''
        let imageUrl = ''
        let animationUrl = ''
        let metadata: ImpactMetadata | null = null
        let impactValue: string | null = null
        let dcuReward: string | null = null

        if (level > 0) {
          try {
            // Try to get token URI from NFT contract if tokenId exists
            if (tokenId !== null) {
              tokenURI = await getTokenURI(tokenId)
            }
            
            // Fallback to level-based metadata if no token URI
            if (!tokenURI) {
              tokenURI = await getTokenURIForLevel(level)
            }


            const convertIPFSToGateway = (ipfsUrl: string, gateways?: string[]) => {
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
              const gatewayList = gateways || defaultGateways
              return `${gatewayList[0]}${path} `
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
                  const url = `${gateway}${path} `
                  const response = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    redirect: 'follow',
                  })
                  if (response.ok) {
                    return response
                  }
                } catch (error) {
                  console.warn(`Gateway ${gateway} failed: `, error)
                }
              }

              throw new Error(`All IPFS gateways failed for: ${ipfsUrl} `)
            }

            if (tokenURI) {
              try {
                const metadataResponse = await fetchWithFallback(tokenURI)
                if (!metadataResponse.ok) {
                  throw new Error(`Failed to fetch metadata: ${metadataResponse.status} ${metadataResponse.statusText} `)
                }

                metadata = (await metadataResponse.json()) as ImpactMetadata
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
              } catch (metadataError) {
                console.error('❌ Error fetching metadata:', metadataError)
                const fallbackCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
                if (fallbackCID && level > 0) {
                  try {
                    const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${fallbackCID}/level${level}.json`
                    const fallbackResponse = await fetch(fallbackUrl)
                    if (fallbackResponse.ok) {
                      metadata = (await fallbackResponse.json()) as ImpactMetadata
                      const stats = extractImpactStats(metadata)
                      impactValue = stats.impactValue
                      dcuReward = stats.dcuReward
                      if (metadata?.image) {
                        imageUrl = convertIPFSToGateway(metadata.image)
                      }
                      if (metadata?.animation_url) {
                        animationUrl = convertIPFSToGateway(metadata.animation_url)
                      }
                    }
                  } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching token URI:', error)
          }
        }

        setProfileData({
          dcuBalance: Number(dcuBalance),
          stakedDCU: Number(stakedDCU),
          level: Number(level),
          streak: Number(streak),
          hasActiveStreak: activeStreak,
          tokenURI,
          imageUrl,
          animationUrl,
          metadata,
          tokenId, // continua bigint | null (ok)
          impactValue,
          dcuReward,
        })
        
      } catch (error) {
        console.error('Error fetching profile data:', error)
        setProfileData({
          dcuBalance: 0,
          stakedDCU: 0,
          level: 0,
          streak: 0,
          hasActiveStreak: false,
          tokenURI: '',
          imageUrl: '',
          animationUrl: '',
          metadata: null,
          tokenId: null,
          impactValue: null,
          dcuReward: null,
        })
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    loadProfileData(address, { showSpinner: true })

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected && address) {
        loadProfileData(address, { showSpinner: false })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [address, isConnected, loadProfileData])

  // Check for pending cleanup status (single source of truth = verification.ts)
useEffect(() => {
  if (!isConnected || !address) {
    setCleanupStatus(null)
    return
  }

  let cancelled = false

  async function refresh() {
    try {
      const status = await getUserCleanupStatus(address as Address)

      if (cancelled) return

      // Show cleanup status if there's a pending cleanup OR if user can claim
      // This ensures claim button appears even if hasPendingCleanup logic changes
      if (status.canClaim && status.cleanupId) {
        // Map verification.ts status -> profile cleanupStatus shape
        setCleanupStatus({
          cleanupId: status.cleanupId,
          verified: true, // canClaim means it's verified
          claimed: false, // we don't track claimed here; claim clears pending
          level: 1, // Default level for verified cleanup
          loading: false,
        })
      } else if (status.hasPendingCleanup && status.cleanupId) {
        // Pending cleanup (not yet verified)
        setCleanupStatus({
          cleanupId: status.cleanupId,
          verified: false,
          claimed: false,
          level: 0,
          loading: false,
        })
      } else {
        // No pending cleanup and can't claim
        setCleanupStatus(null)
      }
    } catch (error) {
      console.error('Error checking cleanup status:', error)
      if (!cancelled) setCleanupStatus(null)
    }
  }

  refresh()
  const interval = setInterval(refresh, 10000)
  return () => {
    cancelled = true
    clearInterval(interval)
  }
}, [address, isConnected])


  if (!hasMounted) {
    return <div className="min-h-screen bg-background" />
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-foreground">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to view your profile.
          </p>
          <BackButton href="/" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  const getTierName = (level: number): string => {
    if (level === 0) return 'No Level'
    if (level <= 3) return 'Newbie'
    if (level <= 6) return 'Pro'
    if (level <= 9) return 'Hero'
    if (level === 10) return 'Guardian'
    return 'Unknown'
  }

  const impactExplorerUrl =
    profileData.tokenId && CONTRACT_ADDRESSES.IMPACT_PRODUCT
      ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}?a=${profileData.tokenId.toString()}`
      : null
  const impactContractUrl = CONTRACT_ADDRESSES.IMPACT_PRODUCT
    ? `${REQUIRED_BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}`
    : null

  const handleManualCopy = async (value: string, label: string) => {
    if (!value) return
    try {
      setCopyingField(label)
      await navigator.clipboard.writeText(value)
      alert(`${label} copied to clipboard.`)
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error)
      alert(`${label}: ${value}`)
    } finally {
      setCopyingField(null)
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <BackButton href="/" />
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              My Profile
            </h1>
            <p className="text-sm text-gray-400">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (isRefreshing || !address) return
              setIsRefreshing(true)
              try {
                await loadProfileData(address, { showSpinner: false })
              } catch (error) {
                console.error('Error refreshing profile:', error)
              } finally {
                setIsRefreshing(false)
              }
            }}
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white"
            title="Refresh profile data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Three-Column Dashboard Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Personal Stats */}
          <DashboardPersonalStats
            dcuBalance={Number(profileData.dcuBalance)}
            cleanupsDone={profileData.level}
            cleanupsDCU={profileData.level * 10}
            referrals={0}
            referralsDCU={0}
            streakWeeks={profileData.streak}
            streakDCU={profileData.streak * 3}
            enhancedReportsDCU={0}
            hasActiveStreak={profileData.hasActiveStreak}
          />

          {/* Middle Column: Impact Product */}
          <DashboardImpactProduct
            level={profileData.level}
            imageUrl={profileData.imageUrl}
            animationUrl={profileData.animationUrl}
            dcuAttached={profileData.level * 10}
            impactValue={profileData.impactValue}
            tokenId={profileData.tokenId}
            contractAddress={CONTRACT_ADDRESSES.IMPACT_PRODUCT}
          />

          {/* Right Column: Actions */}
          <DashboardActions
            address={address || ''}
            cleanupStatus={cleanupStatus && cleanupStatus.cleanupId ? {
              hasPendingCleanup: !cleanupStatus.verified && !cleanupStatus.claimed,
              canClaim: cleanupStatus.verified && !cleanupStatus.claimed,
              cleanupId: cleanupStatus.cleanupId,
              level: cleanupStatus.level,
            } : null}
            onClaim={async () => {
              // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
              if (cleanupStatus?.cleanupId === undefined || cleanupStatus?.cleanupId === null || isClaiming) {
                console.warn('[Profile] Claim blocked:', {
                  cleanupId: cleanupStatus?.cleanupId?.toString(),
                  isClaiming,
                })
                return
              }
            
              try {
                setIsClaiming(true)
            
                await claimImpactProductFromVerification(cleanupStatus.cleanupId)

                // Mark as claimed in localStorage
                if (address && cleanupStatus.cleanupId) {
                  markCleanupAsClaimed(address as Address, cleanupStatus.cleanupId)
                }

                alert(
                  `✅ Claim submitted!\n\n` +
                  `Your claim transaction was sent.\n\n` +
                  `Please wait for confirmation and refresh the page in a moment.`
                )
            
                // Refresh local status + profile data + cleanup status
                if (address) {
                  // Wait longer for state to update after claim (RPC propagation + NFT operations)
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  
                  console.log('[Profile] Refreshing profile data after claim...')
                  await loadProfileData(address as Address, { showSpinner: false })
                  console.log('[Profile] Profile data refreshed')
                  
                  // Refresh cleanup status to hide claim button
                  const newStatus = await getUserCleanupStatus(address as Address)
                  console.log('[Profile] New cleanup status:', newStatus)
                  setCleanupStatus(newStatus ? {
                    cleanupId: newStatus.cleanupId ?? null,
                    verified: newStatus.hasPendingCleanup && !newStatus.canSubmit,
                    claimed: !newStatus.canClaim && newStatus.hasPendingCleanup,
                    level: newStatus.level || (newStatus.canClaim ? 1 : 0),
                    loading: false,
                  } : null)
                }
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
  )
}
