'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { buildFundingReviewMessage } from '@/lib/sponsor/review-signing'
import type { SponsorEventDto } from '@/lib/sponsor/types'

type Props = {
  reviewerAddress: Address
  signMessage: (message: string) => Promise<`0x${string}`>
  onNotify?: (params: { variant: 'success' | 'error'; title: string; message: string }) => void
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

export function FundingApplicationsVerifierSection({ reviewerAddress, signMessage, onNotify }: Props) {
  const [pending, setPending] = useState<SponsorEventDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sponsor/events?status=pending', {
        headers: { 'x-sponsor-reviewer-wallet': reviewerAddress },
        cache: 'no-store',
      })
      const data = (await res.json()) as { events?: SponsorEventDto[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setPending(data.events || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setPending([])
    } finally {
      setLoading(false)
    }
  }, [reviewerAddress])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (eventId: string, action: 'approve' | 'reject') => {
    setBusyId(eventId)
    try {
      const timestamp = Date.now()
      const message = buildFundingReviewMessage({
        action,
        eventId,
        reviewer: reviewerAddress,
        timestamp,
      })
      const signature = await signMessage(message)
      const res = await fetch('/api/sponsor/events/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          action,
          reviewer: reviewerAddress,
          timestamp,
          signature,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Review failed')
      onNotify?.({
        variant: 'success',
        title: action === 'approve' ? 'Funding approved' : 'Application rejected',
        message:
          action === 'approve'
            ? 'Campaign is now live on /sponsor for cUSD donations.'
            : 'Application marked ended.',
      })
      await load()
    } catch (e) {
      onNotify?.({
        variant: 'error',
        title: 'Review failed',
        message: e instanceof Error ? e.message : 'Could not review',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg tracking-wider text-foreground">Funding applications</h2>
        <button type="button" className="text-xs text-brand-green hover:underline" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Community donation pages. Approve to list on /sponsor; reject to close.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}
      {!loading && !error && pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending funding applications.</p>
      ) : null}

      <ul className="space-y-3">
        {pending.map((ev) => (
          <li key={ev.id} className="rounded-xl border border-border/80 bg-background/40 p-3">
            <p className="font-medium text-foreground">{ev.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ev.location} · goal {ev.fundingGoalCusd} cUSD
              {ev.submittedBy ? ` · by ${short(ev.submittedBy)}` : ''}
            </p>
            {ev.whyFunding ? <p className="mt-2 text-sm text-foreground/90">{ev.whyFunding}</p> : null}
            <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              {ev.communitySize ? (
                <div>
                  <dt className="uppercase tracking-wide opacity-70">Community</dt>
                  <dd>{ev.communitySize}</dd>
                </div>
              ) : null}
              {ev.eventFrequency ? (
                <div>
                  <dt className="uppercase tracking-wide opacity-70">Frequency</dt>
                  <dd>{ev.eventFrequency}</dd>
                </div>
              ) : null}
              {ev.impactSummary ? (
                <div className="sm:col-span-2">
                  <dt className="uppercase tracking-wide opacity-70">Impact</dt>
                  <dd>{ev.impactSummary}</dd>
                </div>
              ) : null}
              <div>
                <dt className="uppercase tracking-wide opacity-70">Recipient</dt>
                <dd className="font-mono">{short(ev.recipientAddress)}</dd>
              </div>
              {ev.impactPortfolioUrl ? (
                <div>
                  <dt className="uppercase tracking-wide opacity-70">Portfolio</dt>
                  <dd>
                    <a
                      href={ev.impactPortfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-green hover:underline"
                    >
                      Open
                    </a>
                  </dd>
                </div>
              ) : null}
              {ev.socialLinks ? (
                <div className="sm:col-span-2">
                  <dt className="uppercase tracking-wide opacity-70">Socials</dt>
                  <dd className="whitespace-pre-wrap break-all">{ev.socialLinks}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busyId === ev.id}
                onClick={() => void review(ev.id, 'approve')}
              >
                {busyId === ev.id ? '…' : 'Approve for /sponsor'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/10"
                disabled={busyId === ev.id}
                onClick={() => void review(ev.id, 'reject')}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
