'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import type { SponsorEventDto } from '@/lib/sponsor/types'

function formatCusd(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function progressPct(raised: number, goal: number): number {
  if (!(goal > 0)) return 0
  return Math.min(100, Math.round((raised / goal) * 100))
}

export function SponsorEventSharePanel({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<SponsorEventDto | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/sponsor/events/${eventId}`, { cache: 'no-store' })
        const data = (await res.json()) as {
          event?: SponsorEventDto
          openForDonations?: boolean
          error?: string
        }
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || 'Event not found')
            setEvent(null)
          }
          return
        }
        if (!cancelled) {
          setEvent(data.event || null)
          setOpen(Boolean(data.openForDonations))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventId])

  const pct = event ? progressPct(event.amountRaisedCusd, event.fundingGoalCusd) : 0

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden px-4 py-6 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,_rgba(250,255,0,0.12),_transparent_65%)]"
      />

      <div className="relative space-y-5">
        <div>
          <BackToDeCleanupLink className="mr-3" />
          <Link href="/sponsor" className="text-xs text-gray-500 hover:text-brand-green hover:underline">
            ← All events
          </Link>
          <div className="mt-3 flex items-center gap-2 text-brand-yellow">
            <Share2 className="h-4 w-4" />
            <span className="font-heading text-[11px] uppercase tracking-wider">Cleanup fundraiser</span>
          </div>
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : null}
        {error ? <p className="text-sm text-amber-200">{error}</p> : null}

        {event ? (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
            <div>
              <h1 className="font-heading text-xl tracking-wider text-white">{event.name}</h1>
              <p className="mt-1 text-sm text-gray-400">
                {event.location} · {event.organiser}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {event.eventDate
                  ? new Date(event.eventDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Ongoing'}
                {event.status === 'pending' ? ' · Under review' : ` · ${event.status}`}
              </p>
            </div>

            {open ? (
              <>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-gray-400">
                    <span>{formatCusd(event.amountRaisedCusd)} cUSD raised</span>
                    <span>Goal {formatCusd(event.fundingGoalCusd)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-green transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <Link
                  href={`/sponsor?event=${event.id}`}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/15 font-heading text-sm font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/25"
                >
                  Sponsor with cUSD
                </Link>
              </>
            ) : (
              <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-3">
                <p className="text-sm text-gray-300">
                  {event.status === 'pending'
                    ? 'Awaiting publish. Donations open once DeCleanup lists this event.'
                    : 'This event is not open for donations right now.'}
                </p>
                <Link href="/sponsor" className="mt-2 inline-flex text-sm text-brand-green hover:underline">
                  Browse open events →
                </Link>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
