'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useConfig, useConnect } from 'wagmi'
import type { Address } from 'viem'
import { Lock, Share2, Sprout, Unlock } from 'lucide-react'
import { PageBackButton } from '@/components/layout/PageBackButton'
import { Button } from '@/components/ui/button'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import { getMergedUserLevel } from '@/lib/blockchain/merge-reward-stats'
import { connectWithWalletConnect } from '@/lib/blockchain/connect-wallet-connect'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { campaignText } from '@/lib/sponsor/display'

const MIN_LEVEL = SPONSOR_CONFIG.minLevelToPropose

export function SponsorSubmitPanel() {
  const { address, isConnected } = useAccount()
  const config = useConfig()
  const { connectAsync, connectors, isPending } = useConnect()
  const { submissionOwnerAddress, publicWalletAddress, onchainOwnerAddress } = useSmartAccountClient()

  const rewardIdentity = (publicWalletAddress ?? address) as Address | undefined
  const submissionOwner = (onchainOwnerAddress ?? submissionOwnerAddress ?? address) as Address | undefined

  const [level, setLevel] = useState<number | null>(null)
  const [levelLoading, setLevelLoading] = useState(false)

  const loadLevel = useCallback(async () => {
    if (!rewardIdentity) {
      setLevel(null)
      return
    }
    setLevelLoading(true)
    try {
      setLevel(await getMergedUserLevel(rewardIdentity, submissionOwner ?? null))
    } catch {
      setLevel(0)
    } finally {
      setLevelLoading(false)
    }
  }, [rewardIdentity, submissionOwner])

  useEffect(() => {
    if (isConnected) void loadLevel()
    else setLevel(null)
  }, [isConnected, loadLevel])

  const connect = async () => {
    const injected = connectors.find((x) => x.id === 'injected' || x.type === 'injected') || null
    const wc = connectors.find((x) => x.id === 'walletConnect') || null
    const c = injected || wc
    if (!c) return
    if (c.id === 'walletConnect') {
      await connectWithWalletConnect({ config, connector: c, connectAsync })
      return
    }
    await connectAsync({ connector: c })
  }

  const communityUnlocked = isConnected && level != null && level >= MIN_LEVEL

  return (
    <div className="relative mx-auto w-full max-w-md overflow-y-auto px-4 py-6 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(88,177,47,0.18),_transparent_65%)]"
      />

      <div className="relative space-y-5 pb-10">
        <div>
          <PageBackButton />
          <h1 className={`mt-4 ${campaignText.title}`}>Apply for funding</h1>
          <p className={`mt-1 ${campaignText.note}`}>
            Two paths. Start with community donations (MiniPay / cUSD, or USDC on Base). Gardens unlocks later.
          </p>
        </div>

        {!isConnected ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
            <p className={campaignText.body}>Connect the wallet that holds your Impact Product.</p>
            <Button type="button" className="w-full" disabled={isPending} onClick={() => void connect()}>
              {isPending ? 'Connecting…' : 'Connect wallet'}
            </Button>
          </div>
        ) : null}

        {isConnected && levelLoading ? (
          <p className={campaignText.note}>Checking eligibility…</p>
        ) : null}

        {/* Path 1: community / MiniPay */}
        <section
          className={`rounded-2xl border p-4 ${
            communityUnlocked
              ? 'border-brand-green/40 bg-brand-green/5'
              : 'border-white/10 bg-zinc-950/80 opacity-90'
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                <Share2 className="h-4 w-4" />
              </span>
              <div>
                <p className={campaignText.cardTitle}>Community donations</p>
                <p className={campaignText.cardHint}>MiniPay · Base Pay · share link · cUSD or USDC</p>
              </div>
            </div>
            {communityUnlocked ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-heading uppercase tracking-wide text-brand-green">
                <Unlock className="h-3 w-3" /> Open
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 font-heading uppercase tracking-wide ${campaignText.meta}`}>
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className={`rounded-md border border-white/10 bg-black/40 px-2 py-0.5 uppercase tracking-wide ${campaignText.meta}`}>
              Level {MIN_LEVEL}+
            </span>
            <span className={`rounded-md border border-white/10 bg-black/40 px-2 py-0.5 uppercase tracking-wide ${campaignText.meta}`}>
              Verifier review
            </span>
            <Link
              href="/sponsor"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-brand-green hover:underline"
            >
              Live here
            </Link>
          </div>

          {isConnected && level != null ? (
            <div className="mb-3">
              <div className={`mb-1 flex justify-between ${campaignText.meta}`}>
                <span>Your level</span>
                <span>
                  {level} / {MIN_LEVEL}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-green/80"
                  style={{ width: `${Math.min(100, (level / MIN_LEVEL) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {communityUnlocked ? (
            <Link
              href="/sponsor/apply"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/15 font-heading text-sm font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/25"
            >
              Submit for donations
            </Link>
          ) : (
            <p className={campaignText.note}>
              Reach Impact Product level {MIN_LEVEL}, then come back to apply. Verifiers will review
              before your page goes live for donors.
            </p>
          )}
        </section>

        {/* Path 2: Gardens (placeholder copy) */}
        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 opacity-80">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-gray-400">
                <Sprout className="h-4 w-4" />
              </span>
              <div>
                <p className={campaignText.cardTitle}>Gardens pool</p>
                <p className={campaignText.cardHint}>
                  Needs {SPONSOR_CONFIG.gardensMinCdcu}+ $cDCU
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 font-heading uppercase tracking-wide ${campaignText.meta}`}>
              <Lock className="h-3 w-3" /> Locked
            </span>
          </div>
          <p className={campaignText.note}>
            Details coming soon. Use community donations first if you do not hold enough $cDCU yet.
          </p>
        </section>

        <Link href="/sponsor" className={`block text-center hover:text-brand-green ${campaignText.meta}`}>
          Browse live donation pages
        </Link>
      </div>
    </div>
  )
}
