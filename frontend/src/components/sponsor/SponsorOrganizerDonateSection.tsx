'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { isAddress } from 'viem'
import { SponsorDonorPaymentOptions } from '@/components/sponsor/SponsorDonorPaymentOptions'
import { campaignText } from '@/lib/sponsor/display'
import {
  organizerDonateEvent,
  readOrganizerDonateMemory,
  writeOrganizerDonateMemory,
} from '@/lib/sponsor/organizer-donate'

export function SponsorOrganizerDonateSection() {
  const searchParams = useSearchParams()
  const toFromQuery = searchParams.get('to') || ''
  const cleanupFromQuery = searchParams.get('cleanup') || ''
  const placeFromQuery = searchParams.get('place') || ''
  const fromCleanup = Boolean(toFromQuery && isAddress(toFromQuery))

  const [recipient, setRecipient] = useState(toFromQuery)
  const [cleanupId, setCleanupId] = useState(cleanupFromQuery)
  const [place, setPlace] = useState(placeFromQuery)

  useEffect(() => {
    if (fromCleanup) {
      setRecipient(toFromQuery)
      setCleanupId(cleanupFromQuery)
      setPlace(placeFromQuery)
      writeOrganizerDonateMemory({
        to: toFromQuery,
        cleanup: cleanupFromQuery || undefined,
        place: placeFromQuery || undefined,
      })
      return
    }
    const saved = readOrganizerDonateMemory()
    if (!saved) return
    setRecipient((current) => current || saved.to)
    setCleanupId((current) => current || saved.cleanup || '')
    setPlace((current) => current || saved.place || '')
  }, [fromCleanup, toFromQuery, cleanupFromQuery, placeFromQuery])

  const event = useMemo(
    () => organizerDonateEvent({ recipient, cleanupId, place }),
    [recipient, cleanupId, place]
  )

  return (
    <section id="existing-cleanup" className="space-y-3">
      <h2 className={campaignText.label}>Existing cleanup</h2>
      <p className={campaignText.note}>
        Donate to the organizer of a verified cleanup. Pick a chain, enter an amount, then connect
        a wallet to send.
      </p>
      {place ? (
        <p className={campaignText.formValue}>
          {place}
          {cleanupId ? ` · cleanup ${cleanupId}` : ''}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className={campaignText.formLabel}>Organizer wallet</span>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="w-full break-all rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-brand-green/50"
        />
      </label>
      {recipient && !event ? (
        <p className="text-xs text-amber-300">Enter a valid wallet address.</p>
      ) : null}
      {event ? (
        <SponsorDonorPaymentOptions
          key={`${event.id}-${event.recipientAddress}`}
          event={event}
          onRecorded={() => undefined}
        />
      ) : (
        <p className={campaignText.noteBox}>
          The organizer wallet from the cleanup is filled in when you arrive from Check a cleanup.
          Then pick Celo, Base, or Robinhood and connect to donate.
        </p>
      )}
    </section>
  )
}
