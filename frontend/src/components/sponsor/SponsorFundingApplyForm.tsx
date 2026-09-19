'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAccount, useConfig, useConnect } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { PageBackButton } from '@/components/layout/PageBackButton'
import { Button } from '@/components/ui/button'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import { getMergedUserLevel } from '@/lib/blockchain/merge-reward-stats'
import { connectWithWalletConnect } from '@/lib/blockchain/connect-wallet-connect'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useEffect } from 'react'

const MIN_LEVEL = SPONSOR_CONFIG.minLevelToPropose

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green/50'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-gray-600">{hint}</span> : null}
    </label>
  )
}

export function SponsorFundingApplyForm() {
  const { address, isConnected } = useAccount()
  const config = useConfig()
  const { connectAsync, connectors, isPending } = useConnect()
  const { submissionOwnerAddress, publicWalletAddress, onchainOwnerAddress } = useSmartAccountClient()

  const rewardIdentity = (publicWalletAddress ?? address) as Address | undefined
  const submissionOwner = (onchainOwnerAddress ?? submissionOwnerAddress ?? address) as Address | undefined

  const [eligible, setEligible] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [whyFunding, setWhyFunding] = useState('')
  const [communitySize, setCommunitySize] = useState('')
  const [eventFrequency, setEventFrequency] = useState('')
  const [impactSummary, setImpactSummary] = useState('')
  const [fundingGoal, setFundingGoal] = useState('')
  const [recipient, setRecipient] = useState('')
  const [socialLinks, setSocialLinks] = useState('')
  const [nextEventDate, setNextEventDate] = useState('')

  useEffect(() => {
    if (address && !recipient) setRecipient(address)
  }, [address, recipient])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isConnected || !rewardIdentity) {
        if (!cancelled) {
          setEligible(false)
          setChecking(false)
        }
        return
      }
      setChecking(true)
      try {
        const level = await getMergedUserLevel(rewardIdentity, submissionOwner ?? null)
        if (!cancelled) setEligible(level >= MIN_LEVEL)
      } catch {
        if (!cancelled) setEligible(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, rewardIdentity, submissionOwner])

  const portfolioUrl = rewardIdentity
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://dapp.decleanup.net'}/impact/${rewardIdentity}`
    : ''

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!eligible || !rewardIdentity) {
      setError(`Reach Impact Product level ${MIN_LEVEL} first.`)
      return
    }
    if (!name.trim() || !location.trim() || !whyFunding.trim()) {
      setError('Fill campaign name, location, and why you need funding.')
      return
    }
    const goal = Number(fundingGoal)
    if (!(goal > 0)) {
      setError('Funding goal must be greater than zero.')
      return
    }
    if (!isAddress(recipient.trim())) {
      setError('Recipient must be a valid 0x wallet address.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/sponsor/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          location,
          organiser: name,
          eventDate: nextEventDate || null,
          fundingGoalCusd: goal,
          recipientAddress: recipient.trim(),
          whyFunding,
          communitySize,
          eventFrequency,
          impactSummary,
          socialLinks,
          impactPortfolioUrl: portfolioUrl,
          asProposal: true,
          walletAddress: rewardIdentity,
          onchainOwner: submissionOwner || undefined,
        }),
      })
      const data = (await res.json()) as { error?: string; event?: { id: string } }
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      if (data.event?.id) setSubmittedId(data.event.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  if (submittedId) {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/sponsor/e/${submittedId}`
        : `/sponsor/e/${submittedId}`
    return (
      <div className="mx-auto w-full max-w-md space-y-4 overflow-y-auto px-4 py-6 pb-12 sm:px-5">
        <PageBackButton href="/sponsor/submit" />
        <h1 className="mt-4 font-heading text-2xl tracking-wider text-white">Submitted</h1>
        <p className="text-sm text-gray-400">
          A verifier will review your application. When approved, donors can fund you on /sponsor.
        </p>
        <p className="break-all rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-gray-300">
          {shareUrl}
        </p>
        <Link href="/sponsor/submit" className="text-sm text-brand-green hover:underline">
          Back to apply for funding
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 overflow-y-auto px-4 py-6 pb-12 sm:px-5">
      <div>
        <PageBackButton href="/sponsor/submit" />
        <h1 className="mt-4 font-heading text-2xl tracking-wider text-white">Submit for donations</h1>
        <p className="mt-1 text-sm text-gray-400">
          Tell donors who you are and why to fund your cleanups. Verifiers approve before you go live.
        </p>
      </div>

      {!isConnected ? (
        <Button type="button" className="w-full" disabled={isPending} onClick={() => void connect()}>
          {isPending ? 'Connecting…' : 'Connect wallet'}
        </Button>
      ) : checking ? (
        <p className="text-sm text-gray-400">Checking level…</p>
      ) : !eligible ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
          <p className="text-sm text-gray-300">Level {MIN_LEVEL}+ required.</p>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
          <Field label="Campaign or group name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bangkok canal crew" />
          </Field>
          <Field label="Location / area">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bangkok, Thailand" />
          </Field>
          <Field label="Why do you need funding?" hint="Equipment, transport, disposal, supplies…">
            <textarea
              className={`${inputClass} min-h-[88px] resize-y`}
              value={whyFunding}
              onChange={(e) => setWhyFunding(e.target.value)}
              placeholder="We need bags, gloves, and dump fees for weekly canal cleanups."
            />
          </Field>
          <Field label="Usual cleanup community size">
            <input
              className={inputClass}
              value={communitySize}
              onChange={(e) => setCommunitySize(e.target.value)}
              placeholder="15-25 people"
            />
          </Field>
          <Field label="How often do events run?">
            <input
              className={inputClass}
              value={eventFrequency}
              onChange={(e) => setEventFrequency(e.target.value)}
              placeholder="Weekly on Sundays"
            />
          </Field>
          <Field label="Usual approximate impact" hint="Bags, kg, area cleaned, or similar numbers">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={impactSummary}
              onChange={(e) => setImpactSummary(e.target.value)}
              placeholder="~40 kg plastic per event, 200m shoreline"
            />
          </Field>
          <Field label="Funding goal (cUSD)">
            <input className={inputClass} inputMode="decimal" value={fundingGoal} onChange={(e) => setFundingGoal(e.target.value)} placeholder="300" />
          </Field>
          <Field label="Next event date (optional)">
            <input className={inputClass} type="date" value={nextEventDate} onChange={(e) => setNextEventDate(e.target.value)} />
          </Field>
          <Field
            label="Recipient wallet (cUSD)"
            hint="Defaults to your connected wallet. Change only if donations should go elsewhere."
          >
            <input
              className={`${inputClass} font-mono text-xs`}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={address || '0x…'}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <Field label="Socials proving impact" hint="X, Instagram, Telegram, photos. One link per line.">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
              placeholder={'https://x.com/…\nhttps://instagram.com/…'}
            />
          </Field>
          <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Impact portfolio (auto)</p>
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-xs text-brand-green hover:underline"
            >
              {portfolioUrl}
            </a>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for verifier review'}
          </Button>
          {error ? (
            <p className="text-sm text-amber-200" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
