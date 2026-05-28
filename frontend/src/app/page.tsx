'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
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
} from 'lucide-react'
import {
  claimImpactProductFromVerification,
  type GaslessClient,
} from '@/lib/blockchain/contracts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CONTRACT_ADDRESSES, MAX_IMPACT_PRODUCT_LEVEL } from '@/lib/blockchain/chain-constants'
import { VERIFIER_CONFIG } from '@/config/verifier'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { DashboardClaimCdcu } from '@/components/dashboard/DashboardClaimCdcu'
import { DashboardProfileCard } from '@/components/dashboard/DashboardProfileCard'
import { DashboardVerifierExtras } from '@/components/dashboard/DashboardVerifierExtras'
import { AlertModal } from '@/components/ui/alert-modal'
import { markCleanupAsClaimed, clearPendingCleanup } from '@/lib/blockchain/verification'
import { resetCleanupState, resetAllCleanupState } from '@/lib/utils/reset-cleanup'
import { DashboardReferralLinkCard } from '@/components/dashboard/DashboardReferralLinkCard'
import { ReferralInviteMessage } from '@/components/referral/ReferralInviteMessage'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useHomeDashboardOnChain } from '@/hooks/useHomeDashboardOnChain'
import { useHomeReferralNotification } from '@/hooks/useHomeReferralNotification'
import {
  SignUnlockModal,
  type SignUnlockModalMode,
} from '@/components/aa/SignUnlockModal'
import { AccountBootstrapPanel } from '@/components/aa/AccountBootstrapPanel'
import { AirdropPendingBanner } from '@/components/airdrop/AirdropPendingBanner'
import { WalletReadyCard } from '@/components/aa/WalletReadyCard'
import { decleanupRewardsTitleStyle } from '@/components/layout/DeCleanupPageHero'
import { useWallet } from '@/providers/WalletProvider'
import type { Address } from 'viem'
import { formatEther } from 'viem'

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


function HomeContent() {
  const [mounted, setMounted] = useState(false)
  const { status: authStatus } = useSession()
  const aaAuth = isAaAuthEnabledClient()
  const {
    address,
    isConnected,
    showMainApp,
    isAuthenticated,
    isEmbeddedAccount,
    walletPhase,
    aaEnabled,
    canTransact,
    walletReady,
    walletBootstrapping,
  } = useAppWalletAddress()
  const { error: walletSetupError, retryWalletBootstrap } = useWallet()
  const [signGate, setSignGate] = useState<{
    mode: SignUnlockModalMode
    purpose: string
  } | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showVerifierRulesModal, setShowVerifierRulesModal] = useState(false)
  const [showEarnModal, setShowEarnModal] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimModal, setClaimModal] = useState<{
    variant: 'success' | 'error' | 'warning'
    title?: string
    message: string
  } | null>(null)
  const claimSuccessHandledRef = useRef(false)
  const claimRefreshAfterModalRef = useRef<(() => Promise<void>) | null>(null)
  const [notifyModal, setNotifyModal] = useState<{ variant: 'success' | 'error' | 'info'; title: string; message: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      (window as any).clearPreFixCleanup = async (cleanupId?: string | number) => {
        if (!cleanupId) {
          console.error('Please provide cleanup ID: window.clearPreFixCleanup(3)')
          return
        }
        try {
          const { markCleanupAsClaimed, clearPendingCleanup } = await import('@/lib/blockchain/verification')
          markCleanupAsClaimed(address as Address, BigInt(cleanupId))
          clearPendingCleanup(address as Address)
          resetCleanupState(address as Address, cleanupId.toString())
          window.location.reload()
        } catch (error) {
          console.error('[clearPreFixCleanup] Error:', error)
          resetCleanupState(address as Address, cleanupId.toString())
          window.location.reload()
        }
      }
    }
  }, [address])

  const chainId = useResolvedChainId()
  const { submissionOwnerAddress, client: gaslessClient } = useSmartAccountClient()
  const {
    cleanupStatus,
    hypercertEligibility,
    rewardStats,
    impactProduct,
    claimFeeInfo,
    hasLoadedDashboardOnce,
    refreshDashboard,
  } = useHomeDashboardOnChain({
    mounted,
    isConnected,
    address: address as Address | undefined,
    submissionOwnerAddress: submissionOwnerAddress as Address | undefined,
    chainId: chainId ?? undefined,
    wantSubmissionDetails: showBreakdown,
  })
  const { showReferralNotification, setShowReferralNotification, referrerAddress } =
    useHomeReferralNotification({
      mounted,
      address: address as Address | undefined,
      isConnected,
      submissionOwnerAddress: submissionOwnerAddress as Address | undefined,
    })

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
    if (!canTransact || !gaslessClient) {
      setSignGate({
        mode: walletPhase === 'pending-password' ? 'set-password' : 'unlock',
        purpose: 'claim your Impact Product level',
      })
      return
    }

    try {
      setIsClaiming(true)

      const claimResult = await claimImpactProductFromVerification(cleanupStatus.cleanupId, {
        gaslessClient: gaslessClient ? (gaslessClient as GaslessClient) : undefined,
        smartAccountAddress: submissionOwnerAddress,
        eoaAddress: address,
      })

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
      const reportDcu =
        claimResult.impactReportRewardsWei != null
          ? Number(formatEther(claimResult.impactReportRewardsWei))
          : null
      const recyclablesDcu =
        claimResult.recyclablesRewardsWei != null
          ? Number(formatEther(claimResult.recyclablesRewardsWei))
          : null

      let successMessage =
        'Your Impact Product was minted or upgraded onchain.'
      if (claimResult.bonusClaimed) {
        successMessage +=
          reportDcu != null || recyclablesDcu != null
            ? ` Impact report + recyclables buckets updated (${reportDcu ?? 0} + ${recyclablesDcu ?? 0} DCU in RewardManager).`
            : ' Impact report and recyclables rewards were submitted onchain.'
      } else if (claimResult.bonusError) {
        successMessage +=
          ' Recyclables / impact-report DCU did not land yet (bonus step failed after NFT). Tap Claim again to retry bonuses only, or refresh in a minute.'
      } else if (!claimResult.nftTxHash) {
        successMessage += ' No new NFT step was required; refresh your dashboard balances.'
      }

      setClaimModal({
        variant: claimResult.bonusError ? 'warning' : 'success',
        title: claimResult.bonusError ? 'Level claimed — bonuses pending' : 'Impact Product claimed',
        message: successMessage,
      })

      setShowReferralNotification(false)

      claimRefreshAfterModalRef.current = async () => {
        await refreshDashboard()
      }
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

  if (aaAuth && authStatus === 'loading') {
    return <AccountBootstrapPanel stage="auth" />
  }

  if (aaEnabled && isEmbeddedAccount && walletBootstrapping) {
    return (
      <AccountBootstrapPanel
        stage="wallet"
        error={walletSetupError}
        onRetry={retryWalletBootstrap}
      />
    )
  }

  // Hero before login — full DeCleanup app only after /login (Google, email, wallet)
  if (!showMainApp) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col bg-background">
        <main className="container mx-auto flex flex-1 min-h-0 flex-col items-center justify-center px-4 py-2 sm:py-4">
          <div className="w-full max-w-3xl space-y-4 sm:space-y-5 text-center">
            {/* Hero Heading: less space above/below */}
            <div className="space-y-2 animate-fade-in-up">
              <h1
                className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl lg:text-7xl"
                style={decleanupRewardsTitleStyle}
              >
                <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent animate-pulse">
                  DECLEANUP
                </span>{' '}
                <span className="text-foreground">REWARDS</span>
              </h1>
              <h2 className="font-sans text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl font-normal mx-auto max-w-2xl normal-case break-words">
                Log cleanups. Build a verified record. Earn your voice in the network.
              </h2>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-1 animate-fade-in-up font-sans">
              {aaAuth ? (
                <Button
                  asChild
                  size="default"
                  className="h-10 px-6 font-sans text-sm !text-black bg-brand-green hover:bg-brand-green/90"
                >
                  <Link href="/login?callbackUrl=/">Log in</Link>
                </Button>
              ) : (
                <WalletConnect />
              )}
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
              {aaAuth
                ? 'Sign in with Google, email, or wallet, then use DeCleanup Rewards.'
                : 'Connect your wallet to start cleaning'}
            </p>
          </div>
        </main>

        <div className="w-full border-t border-brand-green/25 bg-brand-green/10 py-4">
          <div className="container mx-auto flex flex-col items-center justify-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
              Past contributors: check $cDCU airdrop eligibility.
            </p>
            <Button asChild className="shrink-0 bg-brand-green text-black hover:bg-brand-green/90">
              <Link href="/airdrop">Check airdrop</Link>
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
    walletReady &&
    !cleanupStatus?.hasPendingCleanup &&
    !cleanupStatus?.canClaim &&
    rewardStats.userLevel < MAX_IMPACT_PRODUCT_LEVEL
  const showHeroSubmitSlot =
    !cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim && rewardStats.userLevel < MAX_IMPACT_PRODUCT_LEVEL
  const heroMaxLevelLocked = rewardStats.userLevel >= MAX_IMPACT_PRODUCT_LEVEL
  const showHeroClaimCta = !!cleanupStatus?.canClaim
  const showHeroUnderReview = !!cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim

  /** Hero primary CTA: full-width on mobile; centered fixed span from sm up */
  const heroCtaClass =
    'h-auto min-h-0 w-full gap-2 px-8 py-[14px] font-bebas text-lg tracking-wider sm:mx-auto sm:w-auto sm:min-w-[260px] sm:max-w-[360px] sm:text-xl'

  // Main DeCleanup app (submissions, rewards, hypercerts)
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 md:gap-10 px-4 py-4 sm:px-6 sm:py-6">
        {aaEnabled && isEmbeddedAccount && walletPhase === 'pending-password' && <WalletReadyCard />}
        {aaEnabled && isEmbeddedAccount && walletPhase === 'locked' && (
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-400">
            Wallet locked. You&apos;ll be asked for your wallet passkey when you submit or claim onchain in DeCleanup Rewards.{' '}
            <Link href="/wallet" className="font-medium text-brand-green underline">
              Go to smart account settings
            </Link>
            .
          </div>
        )}
        {aaEnabled && isEmbeddedAccount && walletPhase === 'server-only' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            Restore your wallet in{' '}
            <Link href="/wallet" className="font-medium text-brand-green underline">
              Smart account settings
            </Link>
            .
          </div>
        )}
        <AirdropPendingBanner />
        {/* HERO — primary CTA first */}
        <section className="min-w-0 space-y-4 sm:space-y-5">
          <div className="text-center sm:text-left">
            <h1
              className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl"
              style={decleanupRewardsTitleStyle}
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
            {showHeroSubmitSlot && !heroMaxLevelLocked && (
              canHeroSubmit ? (
                <Button
                  asChild
                  className={`${heroCtaClass} inline-flex bg-brand-green text-black hover:bg-brand-green/90`}
                >
                  <Link href="/cleanup" className="inline-flex items-center justify-center">
                    <Leaf className="h-5 w-5 shrink-0" />
                    SUBMIT CLEANUP
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled
                  className={`${heroCtaClass} inline-flex cursor-not-allowed bg-brand-green/40 text-black/70`}
                >
                  <Leaf className="h-5 w-5 shrink-0" />
                  SUBMIT CLEANUP
                </Button>
              )
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
              {address ? (
                <DashboardProfileCard
                  address={address}
                  submissionOwnerAddress={submissionOwnerAddress}
                  onOpenVerifierRules={() => setShowVerifierRulesModal(true)}
                  cleanupStatus={cleanupStatus}
                  claimFeeInfo={claimFeeInfo}
                />
              ) : null}

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

                {showBreakdown ? (
                  <div className="mt-3 space-y-4 border-t border-border/50 pt-3">
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
                    {rewardStats.verifiedCleanupsCount === 1 ? '' : 's'} onchain, but &quot;Impact level DCU&quot; is still
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
              </div>
            </aside>
          </div>

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
        </section>

        <DashboardVerifierExtras />

        {hypercertEligibility?.isEligible && (
          <div className="rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-4">
            <Heart className="mb-2 h-5 w-5 text-brand-yellow" aria-hidden />
            <h3 className="mb-1 font-bebas text-sm tracking-wider text-foreground">
              Hypercert
              {hypercertEligibility.testingOverride && (
                <span className="ml-2 text-xs font-normal text-brand-yellow/70">(Test mode)</span>
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
      {signGate && (
        <SignUnlockModal
          open
          mode={signGate.mode}
          purpose={signGate.purpose}
          onClose={() => setSignGate(null)}
          onSuccess={() => {
            setSignGate(null)
            void handleClaimImpactLevel()
          }}
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
                earn onchain for cleanups, referrals, streaks, reports, verification work, Hypercerts, and similar activity.
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
            Past contributor? Check or claim your $cDCU airdrop.
          </p>
          <Button
            asChild
            className="w-full shrink-0 bg-brand-green font-bebas text-sm uppercase tracking-wider text-black hover:bg-brand-green/90 sm:w-auto sm:min-w-[11rem]"
          >
            <Link href="/airdrop">Airdrop</Link>
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
