'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAccount, useChainId } from 'wagmi'
import { Leaf, Award, Users, Share2, Copy, Heart, TrendingUp, Flame, Info, FileText, Shield, Trophy, CheckSquare, Loader2 } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { claimImpactProductFromVerification, getHypercertEligibility } from '@/lib/blockchain/contracts'
import { useIsVerifier } from '@/hooks/useIsVerifier'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
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
    cleanupCount: bigint
    hypercertCount: bigint
    isEligible: boolean
  } | null>(null)
  const [mintingHypercert, setMintingHypercert] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      setHypercertEligibility(null)
      return
    }

    async function checkStatus() {
      if (!address) return
      try {
        const [status, eligibility] = await Promise.all([
          getUserCleanupStatus(address),
          getHypercertEligibility(address),
        ])
        setCleanupStatus(status)
        setHypercertEligibility(eligibility)
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }

    checkStatus()
  }, [mounted, isConnected, address])

  const handleMintHypercert = async () => {
    if (!address || !hypercertEligibility?.isEligible) return

    setMintingHypercert(true)
    try {
      const hypercertNumber = Number(hypercertEligibility.hypercertCount) + 1
      const handleMintHypercert = async () => {
        if (!address || !hypercertEligibility?.isEligible) return
      
        setMintingHypercert(true)
      
        try {
          const hypercertNumber =
            Number(hypercertEligibility.hypercertCount) + 1
      
          const result = await mintHypercert(address, hypercertNumber)
      
          const message =
            `✅ Hypercert eligibility registered successfully!\n\n` +
            `Transaction: ${result.txHash}\n` +
            `Hypercert ID: ${result.hypercertId}\n` +
            `Owner: ${result.owner}\n\n` +
            `ℹ️ Hypercert metadata & claiming will be enabled in a future milestone.`
      
          alert(message)
      
          const newEligibility = await getHypercertEligibility(address)
          setHypercertEligibility(newEligibility)
        } catch (error) {
          console.error('Error minting hypercert:', error)
      
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred'
      
          alert(
            `❌ Failed to register hypercert eligibility:\n\n${errorMessage}`
          )
        } finally {
          setMintingHypercert(false)
        }
      }
      
      
      
      
      // Refresh eligibility
      const newEligibility = await getHypercertEligibility(address)
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
              Apply with your cleanup results to receive a DeCleanup Impact Product, earn community token cDCU, and progress through levels.
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
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        {/* Header Section */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="font-bebas text-3xl tracking-wider text-foreground sm:text-4xl">
              DASHBOARD
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your impact and earnings
            </p>
          </div>
          <button
            onClick={() => setShowEarnModal(true)}
            className="flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-brand-green hover:bg-brand-green/20 transition-colors"
            title="Learn how to earn more cDCU"
          >
            <Info className="h-4 w-4" />
            <span className="font-bebas text-sm tracking-wide hidden sm:inline">HOW TO EARN</span>
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Left: Stats & Invite */}
          <div className="flex h-full flex-col gap-4 min-h-0 lg:flex-[1.2]">
            {/* Stats Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0">
              <h2 className="mb-4 font-bebas text-xl tracking-wider text-foreground">
                YOUR STATS
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Cleanups', icon: TrendingUp, value: hypercertEligibility ? Number(hypercertEligibility.cleanupCount).toString() : '0', color: 'text-brand-green', showToken: false },
                  { label: 'Referrals', icon: Users, value: '0', color: 'text-brand-green', showToken: true },
                  { label: 'Streak', icon: Flame, value: '0', color: 'text-brand-yellow', sub: 'Active', showToken: true },
                  { label: 'Reports', icon: FileText, value: '0', color: 'text-brand-green', showToken: true },
                  { label: 'Hypercerts', icon: Heart, value: hypercertEligibility ? Number(hypercertEligibility.hypercertCount).toString() : '0', color: 'text-brand-green', showToken: true },
                  { label: 'Verifier', icon: Shield, value: '0', color: isVerifierUser ? 'text-brand-green' : 'text-muted-foreground', showToken: true },
                ].map((stat) => {
                  const IconComponent = stat.icon
                  return (
                    <div key={stat.label} className="group rounded-xl border border-border bg-background/50 p-4 hover:border-brand-green/50 hover:bg-background transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                        <IconComponent className={`h-4 w-4 ${stat.color} transition-transform group-hover:scale-110`} />
                      </div>
                      <p className="font-bebas text-2xl text-foreground leading-none">
                        {stat.value}{stat.showToken ? ' $cDCU' : ''}
                      </p>
                      {stat.sub && <p className="mt-1 text-[10px] text-brand-yellow">{stat.sub}</p>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Leaderboard Link */}
            <Link href="/leaderboard" className="block">
              <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0 hover:border-brand-green/50 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-brand-yellow group-hover:scale-110 transition-transform" />
                  <h3 className="font-bebas text-xl tracking-wider text-foreground">
                    LEADERBOARD
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  See top contributors by total $cDCU earned
                </p>
              </div>
            </Link>

            {/* Hypercert Minting Button */}
            {hypercertEligibility?.isEligible && (
              <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/10 p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-5 w-5 text-brand-yellow" />
                  <h3 className="font-bebas text-xl tracking-wider text-foreground">
                    HYPERCERT READY
                  </h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  You've completed {Number(hypercertEligibility.cleanupCount)} cleanups! Mint your Hypercert to claim your impact certificate.
                </p>
                <Button
                  onClick={handleMintHypercert}
                  disabled={mintingHypercert}
                  className="w-full gap-2 bg-brand-yellow px-4 py-3 h-auto font-bebas text-sm tracking-wider text-black hover:bg-brand-yellow/90 disabled:opacity-50"
                >
                  {mintingHypercert ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      MINTING...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" />
                      MINT HYPERCERT
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Verifier Stats */}
            {isVerifierUser && (
              <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-brand-green" />
                  <h3 className="font-bebas text-xl tracking-wider text-foreground">
                    VERIFIER
                  </h3>
                </div>
                <div className="rounded-lg border border-brand-green/20 bg-background/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Earned from Verifying</span>
                    <span className="font-bebas text-lg text-brand-green">0 $cDCU</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    1 $cDCU per verified submission
                  </p>
                </div>
              </div>
            )}

            {/* Invite Friends */}
            <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-brand-green" />
                <h3 className="font-bebas text-xl tracking-wider text-foreground">
                  INVITE FRIENDS
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Earn 3 $cDCU when friends verify their first cleanup.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-brand-green/30 bg-brand-green/5 px-3 py-2 h-auto text-xs font-bebas tracking-wider text-brand-green hover:bg-brand-green/10 hover:border-brand-green/50"
                  onClick={() => window.open('https://warpcast.com', '_blank')}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Farcaster
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border px-3 py-2 h-auto text-xs font-bebas tracking-wider hover:bg-accent"
                  onClick={() => {
                    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Join DeCleanup Rewards!')}`
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
                    const link = `${window.location.origin}?ref=${address}`
                    try {
                      await navigator.clipboard.writeText(link)
                      alert('Referral link copied!')
                    } catch (error) {
                      alert(link)
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Middle: Impact Product */}
          <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 min-h-0 lg:flex-[1]">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <Award className="h-5 w-5 text-brand-yellow" />
              <h2 className="font-bebas text-xl tracking-wider text-foreground">
                IMPACT PRODUCT
              </h2>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-center min-h-0">
              <div className="mb-4 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand-green/5 to-transparent p-8">
                <Award className="h-16 w-16 text-muted-foreground/50 mx-auto" />
              </div>
              <h3 className="mb-2 font-bebas text-2xl tracking-wider text-foreground">
                NOT YET MINTED
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Submit your first cleanup to earn your Impact Product and start your journey
              </p>
              <Link href="/cleanup" className="mt-4">
                <Button className="gap-2 bg-brand-yellow px-6 py-2.5 font-bebas text-sm tracking-wider text-black hover:bg-brand-yellow/90">
                  <Leaf className="h-4 w-4" />
                  GET STARTED
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Actions & Links */}
          <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 min-h-0 lg:flex-[1]">
            <div className="space-y-4 flex-1 min-h-0 overflow-auto pr-1">
              {/* Action Buttons */}
              <div className="flex-shrink-0">
                <h2 className="mb-3 font-bebas text-xl tracking-wider text-foreground">
                  ACTIONS
                </h2>
                <div className="space-y-2">
                  <Link href="/cleanup" className="block">
                    <Button className="w-full gap-2 bg-brand-yellow py-3 font-bebas text-base tracking-wider text-black hover:bg-brand-yellow/90">
                      <Leaf className="h-4 w-4" />
                      SUBMIT CLEANUP
                    </Button>
                  </Link>
                  <Button
                    disabled
                    className="w-full gap-2 border-2 border-muted bg-muted py-3 font-bebas text-base tracking-wider text-muted-foreground cursor-not-allowed">
                    <Award className="h-4 w-4" />
                    CLAIM LEVEL
                  </Button>
                  <Link href="/verifier" className="block">
                    <Button 
                      className="w-full gap-2 bg-brand-green py-3 font-bebas text-base tracking-wider text-black hover:bg-brand-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!isConnected}
                    >
                      <CheckSquare className="h-4 w-4" />
                      VERIFIER CABINET
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Links */}
              <div className="flex-shrink-0">
                <h3 className="mb-3 font-bebas text-xl tracking-wider text-foreground">
                  LINKS
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'GITHUB', href: 'https://github.com/DeCleanup-Network' },
                    { label: 'LITEPAPER', href: 'https://github.com/DeCleanup-Network' },
                    { label: 'PUBLICATIONS', href: '#' },
                    { label: 'FOLLOW ON X', href: 'https://x.com/decleanupnet' },
                    { label: 'DONATE ON GIVETH', href: 'https://giveth.io/project/decleanup-network-cleaning-the-planet-empowering-communities' },
                    { label: 'JOIN COMMUNITY', href: 'https://t.me/decleanup' },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg border border-border/50 bg-background/50 py-2 text-xs font-bebas tracking-wider text-muted-foreground hover:bg-accent hover:text-brand-green hover:border-brand-green/50 transition-all"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Coming Soon Features */}
              <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="mb-3 font-bebas text-xl tracking-wider text-foreground">
                  COMING SOON
                </h3>
                <div className="space-y-2 flex-1 min-h-0">
                  {['Claim/Stake $', 'Impact Circles', 'Equipment Reimbursement'].map((label) => (
                    <Button
                      key={label}
                      disabled
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-2.5 text-sm font-bebas tracking-wider cursor-not-allowed text-muted-foreground border-muted"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/50 pt-3 flex-shrink-0">
                  <span className="font-bebas text-sm text-muted-foreground">Built on</span>
                  <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                    <span className="font-bebas text-xs tracking-wider uppercase text-foreground">CELO</span>
                  </div>
                </div>
              </div>
            </div>
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
