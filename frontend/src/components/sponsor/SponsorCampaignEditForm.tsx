'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConfig, useConnect } from 'wagmi'
import type { Address } from 'viem'
import { PageBackButton } from '@/components/layout/PageBackButton'
import { Button } from '@/components/ui/button'
import { SponsorPaymentMethodFields } from '@/components/sponsor/SponsorPaymentMethodFields'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import { connectWithWalletConnect } from '@/lib/blockchain/connect-wallet-connect'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { sponsorEventPath } from '@/lib/sponsor/display'
import { isSponsorEventOwner } from '@/lib/sponsor/edit-auth'
import {
  cryptoRecipientFromMethods,
  eventPaymentMethods,
  validatePaymentMethods,
  type SponsorPaymentMethod,
} from '@/lib/sponsor/payment-methods'
import type { SponsorEventDto } from '@/lib/sponsor/types'

const WHY_FUNDING_MAX = SPONSOR_CONFIG.whyFundingMaxChars

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

function toDateInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function SponsorCampaignEditForm({ eventId }: { eventId: string }) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const config = useConfig()
  const { connectAsync, connectors, isPending } = useConnect()
  const { publicWalletAddress, onchainOwnerAddress, submissionOwnerAddress } = useSmartAccountClient()

  const rewardIdentity = (publicWalletAddress ?? address) as Address | undefined
  const linkedOwner = (onchainOwnerAddress ?? submissionOwnerAddress ?? address) as Address | undefined

  const [event, setEvent] = useState<SponsorEventDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [whyFunding, setWhyFunding] = useState('')
  const [communitySize, setCommunitySize] = useState('')
  const [eventFrequency, setEventFrequency] = useState('')
  const [impactSummary, setImpactSummary] = useState('')
  const [fundingGoal, setFundingGoal] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<SponsorPaymentMethod[]>([])
  const [socialLinks, setSocialLinks] = useState('')
  const [nextEventDate, setNextEventDate] = useState('')

  const editorWallet = rewardIdentity || linkedOwner || address || ''

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = editorWallet ? `?wallet=${encodeURIComponent(editorWallet)}` : ''
        const res = await fetch(`/api/sponsor/events/${eventId}${qs}`, { cache: 'no-store' })
        const data = (await res.json()) as { event?: SponsorEventDto; error?: string }
        if (!res.ok || !data.event) {
          if (!cancelled) setError(data.error || 'Campaign not found')
          return
        }
        if (cancelled) return
        const ev = data.event
        setEvent(ev)
        setName(ev.name || '')
        setLocation(ev.location || '')
        setWhyFunding(ev.whyFunding || '')
        setCommunitySize(ev.communitySize || '')
        setEventFrequency(ev.eventFrequency || '')
        setImpactSummary(ev.impactSummary || '')
        setFundingGoal(String(ev.fundingGoalCusd || ''))
        setPaymentMethods(eventPaymentMethods(ev))
        setSocialLinks(ev.socialLinks || '')
        setNextEventDate(toDateInput(ev.eventDate))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventId, editorWallet])

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

  const allowed = Boolean(event && (isSponsorEventOwner(event, editorWallet) || isSponsorEventOwner(event, linkedOwner)))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!allowed || !editorWallet) {
      setError('Connect the organiser wallet to edit this campaign.')
      return
    }
    if (!name.trim() || !location.trim() || !whyFunding.trim()) {
      setError('Fill campaign name, location, and why you need funding.')
      return
    }
    if (whyFunding.trim().length > WHY_FUNDING_MAX) {
      setError(`Why you need funding must be ${WHY_FUNDING_MAX} characters or fewer.`)
      return
    }
    const goal = Number(fundingGoal)
    if (!(goal > 0)) {
      setError('Funding goal must be greater than zero.')
      return
    }
    const paymentError = validatePaymentMethods(paymentMethods)
    if (paymentError) {
      setError(paymentError)
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/sponsor/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          location,
          organiser: name,
          eventDate: nextEventDate || null,
          fundingGoalCusd: goal,
          recipientAddress: cryptoRecipientFromMethods(paymentMethods, editorWallet),
          paymentMethods,
          whyFunding,
          communitySize,
          eventFrequency,
          impactSummary,
          socialLinks,
          walletAddress: editorWallet,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Save failed')
      router.push(sponsorEventPath(eventId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 overflow-y-auto px-4 py-6 pb-12 sm:px-5">
      <div>
        <PageBackButton href={sponsorEventPath(eventId)} label="Back to campaign" />
        <h1 className="mt-4 font-heading text-2xl tracking-wider text-white">Edit campaign</h1>
        <p className="mt-1 text-sm text-gray-400">
          Update the story or add another payment method. Bank and local payments stay outside the app.
        </p>
      </div>

      {!isConnected ? (
        <Button type="button" className="w-full" disabled={isPending} onClick={() => void connect()}>
          {isPending ? 'Connecting…' : 'Connect organiser wallet'}
        </Button>
      ) : loading ? (
        <p className="text-sm text-gray-400">Loading campaign…</p>
      ) : !event ? (
        <p className="text-sm text-amber-200">{error || 'Campaign not found'}</p>
      ) : !allowed ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
          This wallet cannot edit this campaign. Connect the organiser or recipient wallet.
        </p>
      ) : (
        <form onSubmit={(e) => void save(e)} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
          <Field label="Campaign or group name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Location / area">
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field
            label="Why do you need funding?"
            hint={`${whyFunding.length}/${WHY_FUNDING_MAX}`}
          >
            <textarea
              className={`${inputClass} min-h-[88px] resize-y`}
              value={whyFunding}
              maxLength={WHY_FUNDING_MAX}
              onChange={(e) => setWhyFunding(e.target.value.slice(0, WHY_FUNDING_MAX))}
            />
          </Field>
          <Field label="Usual cleanup community size">
            <input className={inputClass} value={communitySize} onChange={(e) => setCommunitySize(e.target.value)} />
          </Field>
          <Field label="How often do events run?">
            <input className={inputClass} value={eventFrequency} onChange={(e) => setEventFrequency(e.target.value)} />
          </Field>
          <Field label="Usual approximate impact">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={impactSummary}
              onChange={(e) => setImpactSummary(e.target.value)}
            />
          </Field>
          <Field label="Funding goal">
            <input
              className={inputClass}
              inputMode="decimal"
              value={fundingGoal}
              onChange={(e) => setFundingGoal(e.target.value)}
            />
          </Field>
          <Field label="Next event date (optional)">
            <input className={inputClass} type="date" value={nextEventDate} onChange={(e) => setNextEventDate(e.target.value)} />
          </Field>
          <Field label="Socials proving impact">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
            />
          </Field>
          <SponsorPaymentMethodFields
            methods={paymentMethods}
            onChange={setPaymentMethods}
            defaultRecipient={event.recipientAddress || editorWallet}
            walletAddress={editorWallet}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Saving…' : 'Save campaign'}
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
