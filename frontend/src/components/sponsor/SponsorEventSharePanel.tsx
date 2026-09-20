'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, MapPin } from 'lucide-react'
import { useAccount } from 'wagmi'
import { PageBackButton } from '@/components/layout/PageBackButton'
import { SponsorCopyLinkButton } from '@/components/sponsor/SponsorCopyLinkButton'
import { SponsorDonorPaymentOptions } from '@/components/sponsor/SponsorDonorPaymentOptions'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import {
  eventShareAbsoluteUrl,
  formatCusd,
  formatEventDate,
  isOpenForDonations,
  parseSocialLinks,
  progressPct,
  verifiedCleanupLabel,
} from '@/lib/sponsor/display'
import { isSponsorEventOwner } from '@/lib/sponsor/edit-auth'
import type { SponsorEventDto } from '@/lib/sponsor/types'

export function SponsorEventSharePanel({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<SponsorEventDto | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState('')
  const { address } = useAccount()
  const { publicWalletAddress, onchainOwnerAddress, submissionOwnerAddress } = useSmartAccountClient()
  const editorWallet = publicWalletAddress || onchainOwnerAddress || submissionOwnerAddress || address

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchEvent = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/sponsor/events/${eventId}`, { cache: 'no-store' })
      const data = (await res.json()) as {
        event?: SponsorEventDto
        openForDonations?: boolean
        error?: string
      }
      if (!res.ok) {
        setError(data.error || 'Cleanup not found')
        setEvent(null)
        return
      }
      setEvent(data.event || null)
      setOpen(Boolean(data.openForDonations || (data.event && isOpenForDonations(data.event))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void fetchEvent()
  }, [fetchEvent])

  const pct = event ? progressPct(event.amountRaisedCusd, event.fundingGoalCusd) : 0
  const shareUrl = eventShareAbsoluteUrl(eventId, origin)
  const socials = parseSocialLinks(event?.socialLinks)

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden px-4 py-6 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,_rgba(88,177,47,0.16),_transparent_65%)]"
      />

      <div className="relative space-y-5">
        <div>
          <PageBackButton href="/sponsor" label="All cleanups" />
          <p className="mt-4 font-heading text-[11px] uppercase tracking-wider text-brand-green">
            Cleanup fundraiser
          </p>
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : null}
        {error ? <p className="text-sm text-amber-200">{error}</p> : null}

        {event ? (
          <>
            <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
              <div>
                <h1 className="font-heading text-2xl tracking-wider text-white">{event.name}</h1>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-300">
                  <MapPin className="h-3.5 w-3.5 text-brand-green" aria-hidden />
                  {event.location}
                </p>
                <p className="mt-1 text-sm text-gray-400">Organised by {event.organiser}</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {formatEventDate(event.eventDate)}
                  {event.status === 'pending' ? ' · Under review' : ` · ${event.status}`}
                </p>
              </div>

              {open ? (
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
                  <p className="mt-2 text-xs text-gray-500">
                    {verifiedCleanupLabel(event.verifiedCleanupsCount)}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <SponsorCopyLinkButton url={shareUrl} title={event.name} label="Share" showUrl />
                {isSponsorEventOwner(event, editorWallet) ? (
                  <Link
                    href={`/sponsor/e/${event.id}/edit`}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 text-xs text-gray-300 hover:border-brand-green/40 hover:text-brand-green"
                  >
                    Edit campaign
                  </Link>
                ) : null}
              </div>
            </section>

            {event.whyFunding ? (
              <section className="space-y-2 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <h2 className="font-heading text-xs tracking-wider text-gray-500">Why this cleanup needs funding</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{event.whyFunding}</p>
              </section>
            ) : null}

            {event.impactSummary ? (
              <section className="space-y-2 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <h2 className="font-heading text-xs tracking-wider text-gray-500">Impact so far</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{event.impactSummary}</p>
              </section>
            ) : null}

            {(event.communitySize || event.eventFrequency) ? (
              <section className="grid gap-3 sm:grid-cols-2">
                {event.communitySize ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                    <p className="font-heading text-xs tracking-wider text-gray-500">Community</p>
                    <p className="mt-1 text-sm text-gray-200">{event.communitySize}</p>
                  </div>
                ) : null}
                {event.eventFrequency ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                    <p className="font-heading text-xs tracking-wider text-gray-500">How often</p>
                    <p className="mt-1 text-sm text-gray-200">{event.eventFrequency}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {(event.impactPortfolioUrl || socials.length > 0) ? (
              <section className="space-y-2 rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                <h2 className="font-heading text-xs tracking-wider text-gray-500">Learn more</h2>
                <div className="flex flex-wrap gap-2">
                  {event.impactPortfolioUrl ? (
                    <a
                      href={event.impactPortfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-green/30 px-3 py-2 text-xs text-brand-green hover:bg-brand-green/10"
                    >
                      Impact portfolio
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {socials.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:text-white"
                    >
                      {new URL(url).hostname.replace(/^www\./, '')}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {open ? (
              <SponsorDonorPaymentOptions
                event={event}
                onRecorded={() => void fetchEvent({ silent: true })}
              />
            ) : (
              <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-3">
                <p className="text-sm text-gray-300">
                  {event.status === 'pending'
                    ? 'Awaiting publish. Donations open once DeCleanup lists this cleanup.'
                    : 'This cleanup is not open for donations right now.'}
                </p>
                <Link href="/sponsor" className="mt-2 inline-flex text-sm text-brand-green hover:underline">
                  Browse open cleanups
                </Link>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
