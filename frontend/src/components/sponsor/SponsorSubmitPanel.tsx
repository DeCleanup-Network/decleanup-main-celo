'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import type { Address } from 'viem'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Leaf,
  Link2,
  Share2,
  Sprout,
  Users,
} from 'lucide-react'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { Button } from '@/components/ui/button'
import { SponsorEventForm, type EventFormValues } from '@/components/sponsor/SponsorEventForm'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import { getMergedUserLevel } from '@/lib/blockchain/merge-reward-stats'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'

const MIN_LEVEL = SPONSOR_CONFIG.minLevelToPropose
const LINKS = SPONSOR_CONFIG.links

type Path = 'choose' | 'gardens' | 'community'

function StepChip({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-green/20 font-heading text-[11px] font-semibold text-brand-green">
        {n}
      </span>
      <span className="text-sm leading-snug text-gray-300">{label}</span>
    </li>
  )
}

function CondRow({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-black/30 px-3 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok === false ? 'bg-white/10 text-gray-500' : 'bg-brand-green/20 text-brand-green'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="text-sm leading-snug text-gray-300">{children}</span>
    </li>
  )
}

function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http')
  const className =
    'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-xs font-heading font-semibold uppercase tracking-wide text-brand-green hover:border-brand-green/40 hover:bg-brand-green/10'
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function SponsorSubmitPanel() {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors, isPending } = useConnect()
  const { submissionOwnerAddress, publicWalletAddress, onchainOwnerAddress } = useSmartAccountClient()

  const rewardIdentity = (publicWalletAddress ?? address) as Address | undefined
  const submissionOwner = (onchainOwnerAddress ?? submissionOwnerAddress ?? address) as Address | undefined

  const [path, setPath] = useState<Path>('choose')
  const [level, setLevel] = useState<number | null>(null)
  const [levelLoading, setLevelLoading] = useState(false)
  const [levelError, setLevelError] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadLevel = useCallback(async () => {
    if (!rewardIdentity) {
      setLevel(null)
      return
    }
    setLevelLoading(true)
    setLevelError(null)
    try {
      const n = await getMergedUserLevel(rewardIdentity, submissionOwner ?? null)
      setLevel(n)
    } catch (e) {
      setLevelError(e instanceof Error ? e.message : 'Could not read Impact Product level')
      setLevel(null)
    } finally {
      setLevelLoading(false)
    }
  }, [rewardIdentity, submissionOwner])

  useEffect(() => {
    if (isConnected && path === 'community') void loadLevel()
  }, [isConnected, path, loadLevel])

  const connect = async () => {
    const c =
      connectors.find((x) => x.id === 'injected' || x.type === 'injected') ||
      connectors.find((x) => x.id === 'walletConnect')
    if (!c) return
    await connectAsync({ connector: c })
  }

  const eligible = level != null && level >= MIN_LEVEL

  const shareUrl =
    typeof window !== 'undefined' && submittedId
      ? `${window.location.origin}/sponsor/e/${submittedId}`
      : submittedId
        ? `/sponsor/e/${submittedId}`
        : ''

  const copyShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const onSubmit = async (values: EventFormValues) => {
    if (!address || !eligible) {
      throw new Error(`Reach Impact Product level ${MIN_LEVEL} to submit.`)
    }
    const res = await fetch('/api/sponsor/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        location: values.location,
        organiser: values.organiser,
        eventDate: values.eventDate,
        fundingGoalCusd: Number(values.fundingGoalCusd),
        recipientAddress: values.recipientAddress,
        asProposal: true,
        walletAddress: rewardIdentity || address,
        onchainOwner: submissionOwner || undefined,
      }),
    })
    const data = (await res.json()) as { error?: string; event?: { id: string } }
    if (!res.ok) throw new Error(data.error || 'Submit failed')
    if (data.event?.id) setSubmittedId(data.event.id)
  }

  const impactHref = rewardIdentity ? `/impact/${rewardIdentity}` : '/profile'

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden px-4 py-6 sm:px-5">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(88,177,47,0.18),_transparent_65%)]"
      />

      <div className="relative space-y-5">
        <div>
          <BackToDeCleanupLink className="mr-3" />
          <Link href="/sponsor" className="text-xs text-gray-500 hover:text-brand-green hover:underline">
            ← Sponsor page
          </Link>
          <h1 className="mt-2 font-heading text-2xl tracking-wider text-white">Get funded</h1>
          <p className="mt-1 text-sm text-gray-400">
            Start with the in-app path — fewer requirements. Gardens comes later if you hold $cDCU.
          </p>
        </div>

        {path !== 'choose' ? (
          <button
            type="button"
            onClick={() => {
              setPath('choose')
              setSubmittedId(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-green"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Both paths
          </button>
        ) : null}

        {path === 'choose' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPath('community')}
              className="group w-full rounded-2xl border border-brand-green/35 bg-brand-green/5 p-4 text-left transition hover:border-brand-green/55 hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
            >
              <div className="mb-2 inline-flex rounded-md bg-brand-green/20 px-2 py-0.5 text-[10px] font-heading font-semibold uppercase tracking-wide text-brand-green">
                Start here
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
                  <Share2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm tracking-wide text-white">Community page</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Level {MIN_LEVEL}+ · submit in-app · share a public cUSD link
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[`Level ${MIN_LEVEL}+`, 'Ops review', 'Share link'].map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="mt-1 text-brand-green opacity-70 transition group-hover:opacity-100">→</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPath('gardens')}
              className="group w-full rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-left transition hover:border-white/25 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <div className="mb-2 inline-flex rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-heading font-semibold uppercase tracking-wide text-gray-500">
                When you have $cDCU
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gray-400">
                  <Sprout className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm tracking-wide text-white">Gardens pool</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Needs {SPONSOR_CONFIG.gardensMinCdcu}+ $cDCU (more levels / airdrop) · conviction vote
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['250+ $cDCU', 'Verified cleanup', 'X post'].map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="mt-1 text-gray-600 opacity-0 transition group-hover:opacity-100">→</span>
              </div>
            </button>

            <p className="px-1 text-center text-[11px] text-gray-600">
              No airdrop yet? Use community first. Add Gardens once you hold enough $cDCU.
            </p>
          </div>
        ) : null}

        {path === 'gardens' ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-brand-green/25 bg-zinc-950/80 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-brand-green" />
                <h2 className="font-heading text-xs tracking-wider text-brand-green">Need these</h2>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Heavier bar than community funding — skip this until you have $cDCU (airdrop or earned).
              </p>
              <ul className="space-y-2">
                <CondRow>
                  Hold <strong className="text-white">{SPONSOR_CONFIG.gardensMinCdcu}+ $cDCU</strong> on
                  your MetaMask / Gardens wallet
                </CondRow>
                <CondRow>
                  At least one <strong className="text-white">verified cleanup</strong> + claimed level
                </CondRow>
                <CondRow>
                  Public <strong className="text-white">X post</strong> tagging @DeCleanupNet &amp;
                  @ETHForTheWorld
                </CondRow>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <OutLink href={LINKS.airdrop}>Check airdrop</OutLink>
                <OutLink href={LINKS.cleanup}>Submit cleanup</OutLink>
                <OutLink href={impactHref}>Impact portfolio</OutLink>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <h2 className="font-heading text-xs tracking-wider text-gray-500">Proposal checklist</h2>
              </div>
              <ol className="space-y-2.5">
                <StepChip n={1} label="Location, date, participant count" />
                <StepChip n={2} label="Itemized costs (bags, gloves, transport, disposal)" />
                <StepChip n={3} label="Link your /impact/… portfolio" />
                <StepChip n={4} label="Link the X post" />
                <StepChip n={5} label="Submit on Gardens — conviction unlocks cUSD payout" />
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <OutLink href={LINKS.gardensCommunity}>Open Gardens</OutLink>
                <OutLink href={LINKS.twitterDeCleanup}>@DeCleanupNet</OutLink>
                <OutLink href={LINKS.twitterEthForTheWorld}>@ETHForTheWorld</OutLink>
                <OutLink href={LINKS.coordinatorPlaybook}>Full playbook</OutLink>
              </div>
            </section>

            <p className="text-center text-[11px] text-gray-600">
              Pool seeded for verified cleanup costs · no committee — conviction threshold pays out
              onchain.
            </p>
          </div>
        ) : null}

        {path === 'community' ? (
          <div className="space-y-4">
            {!submittedId ? (
              <section className="rounded-2xl border border-brand-green/25 bg-zinc-950/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-brand-green" />
                  <h2 className="font-heading text-xs tracking-wider text-brand-green">How it works</h2>
                </div>
                <ol className="space-y-2.5">
                  <StepChip n={1} label={`Reach Impact Product level ${MIN_LEVEL}`} />
                  <StepChip n={2} label="Submit your event (stays private until ops publishes)" />
                  <StepChip n={3} label="Share your public link — sponsors send cUSD in MiniPay" />
                </ol>
              </section>
            ) : null}

            {submittedId ? (
              <section className="space-y-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4">
                <p className="font-heading text-sm tracking-wide text-brand-green">Submitted for review</p>
                <p className="text-sm text-gray-400">
                  Bookmark this link. Once published, donors land on your event and can fund with cUSD.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-xs text-gray-300"
                  />
                  <Button type="button" variant="outline" className="shrink-0 border-white/10" onClick={() => void copyShare()}>
                    {copied ? <Check className="h-4 w-4 text-brand-green" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Link
                  href={`/sponsor/e/${submittedId}`}
                  className="inline-flex text-sm text-brand-green hover:underline"
                >
                  Preview share page →
                </Link>
              </section>
            ) : !isConnected ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <p className="text-sm text-gray-300">Connect the wallet that holds your Impact Product.</p>
                <Button type="button" className="w-full" disabled={isPending} onClick={() => void connect()}>
                  {isPending ? 'Connecting…' : 'Connect wallet'}
                </Button>
              </div>
            ) : levelLoading ? (
              <p className="text-sm text-gray-400">Checking Impact Product level…</p>
            ) : levelError ? (
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-200">{levelError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/10"
                  onClick={() => void loadLevel()}
                >
                  Retry
                </Button>
              </div>
            ) : !eligible ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <p className="text-sm text-white">
                  Level {level ?? 0} / {MIN_LEVEL}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand-green/80 transition-all"
                    style={{ width: `${Math.min(100, ((level ?? 0) / MIN_LEVEL) * 100)}%` }}
                  />
                </div>
                <Link
                  href="/"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/10 text-sm font-heading font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/20"
                >
                  Go to dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <p className="text-xs text-brand-green">Level {level} · unlocked</p>
                <SponsorEventForm
                  mode="proposal"
                  submitLabel="Submit & get share link"
                  onSubmit={onSubmit}
                  hideSuccessMessage
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
