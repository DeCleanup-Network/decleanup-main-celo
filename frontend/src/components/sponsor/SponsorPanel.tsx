'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  formatCusd,
  formatEventDate,
  progressPct,
  sponsorEventPath,
  verifiedCleanupLabel,
} from '@/lib/sponsor/display'
import { eventPaymentMethods, paymentMethodBadges } from '@/lib/sponsor/payment-methods'
import type { SponsorEventDto } from '@/lib/sponsor/types'

function SponsorExitLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm" className="border-border bg-card font-heading tracking-wider">
        <a href="https://decleanup.net" rel="noreferrer">
          Go back to website
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="border-border bg-card font-heading tracking-wider">
        <Link href="/">Back to the app</Link>
      </Button>
    </div>
  )
}

export function SponsorPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventFromQuery = searchParams.get('event')
  const [events, setEvents] = useState<SponsorEventDto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(true)

  useEffect(() => {
    if (!eventFromQuery) return
    router.replace(sponsorEventPath(eventFromQuery))
  }, [eventFromQuery, router])

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/sponsor/events', { cache: 'no-store' })
      const data = (await res.json()) as { events?: SponsorEventDto[]; error?: string }
      if (!res.ok) {
        setLoadError(data.error || 'Could not load events')
        setEvents([])
        return
      }
      setEvents(data.events || [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load events')
      setEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  if (eventFromQuery) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <p className="text-sm text-gray-400">Opening cleanup…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-6 sm:px-5">
      <div>
        <SponsorExitLinks />
        <h1 className="mt-4 font-heading text-2xl tracking-wider text-white">Sponsor a cleanup</h1>
        <p className="mt-1 text-sm text-gray-400">
          Open a campaign to see the story, then donate with cUSD if you want to help.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-xs tracking-wider text-gray-500">Open cleanups</h2>
        {loadingEvents ? (
          <div className="h-28 animate-pulse rounded-xl bg-zinc-900" />
        ) : loadError ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            {loadError}
          </p>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-4">
            <p className="text-sm text-gray-400">No active or upcoming cleanups yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => {
              const pct = progressPct(ev.amountRaisedCusd, ev.fundingGoalCusd)
              const href = sponsorEventPath(ev.id)
              const methodLabels = paymentMethodBadges(eventPaymentMethods(ev))
              return (
                <li key={ev.id}>
                  <article className="rounded-xl border border-white/10 bg-zinc-950/80 p-3 transition hover:border-white/20">
                    <Link href={href} className="block text-left">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white">{ev.name}</p>
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 ring-1 ring-white/10">
                          {ev.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {ev.location} · {ev.organiser}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatEventDate(ev.eventDate)}</p>
                      {methodLabels.length > 0 ? (
                        <p className="mt-1 text-[11px] text-brand-green/80">{methodLabels.join(' · ')}</p>
                      ) : null}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400">
                        {formatCusd(ev.amountRaisedCusd)} / {formatCusd(ev.fundingGoalCusd)} cUSD ·{' '}
                        {verifiedCleanupLabel(ev.verifiedCleanupsCount)}
                      </p>
                      {ev.whyFunding ? (
                        <p className="mt-2 line-clamp-2 text-sm text-gray-300">{ev.whyFunding}</p>
                      ) : null}
                    </Link>
                    <div className="mt-3">
                      <Button asChild className="min-h-[40px]">
                        <Link href={href}>See details</Link>
                      </Button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
