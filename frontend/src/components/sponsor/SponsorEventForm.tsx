'use client'

import { useState } from 'react'
import { isAddress } from 'viem'
import { Button } from '@/components/ui/button'
import type { SponsorEventStatus } from '@/lib/sponsor/types'

export type EventFormValues = {
  name: string
  location: string
  organiser: string
  eventDate: string
  fundingGoalCusd: string
  recipientAddress: string
  verifiedCleanupsCount: string
  status: SponsorEventStatus
}

const empty: EventFormValues = {
  name: '',
  location: '',
  organiser: '',
  eventDate: '',
  fundingGoalCusd: '',
  recipientAddress: '',
  verifiedCleanupsCount: '0',
  status: 'upcoming',
}

type Props = {
  mode: 'proposal' | 'admin'
  submitLabel: string
  onSubmit: (values: EventFormValues) => Promise<void>
  initial?: Partial<EventFormValues>
  /** When true, form hides its own success line (parent shows share UI). */
  hideSuccessMessage?: boolean
}

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

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green/50'

export function SponsorEventForm({ mode, submitLabel, onSubmit, initial, hideSuccessMessage }: Props) {
  const [values, setValues] = useState<EventFormValues>({ ...empty, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set =
    (key: keyof EventFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }))
      setDone(false)
      setError(null)
    }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)

    if (!values.name.trim() || !values.location.trim() || !values.organiser.trim()) {
      setError('Fill name, location, and organiser.')
      return
    }
    if (!values.eventDate) {
      setError('Pick an event date.')
      return
    }
    const goal = Number(values.fundingGoalCusd)
    if (!(goal > 0)) {
      setError('Funding goal must be greater than zero.')
      return
    }
    if (!isAddress(values.recipientAddress.trim())) {
      setError('Recipient must be a valid 0x wallet address (receives cUSD).')
      return
    }

    setBusy(true)
    try {
      await onSubmit(values)
      setDone(true)
      if (mode === 'proposal') setValues({ ...empty, status: 'pending' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <Field label="Event name">
        <input className={inputClass} value={values.name} onChange={set('name')} placeholder="Canal cleanup day" />
      </Field>
      <Field label="Location">
        <input className={inputClass} value={values.location} onChange={set('location')} placeholder="Bangkok, Thailand" />
      </Field>
      <Field label="Organiser">
        <input
          className={inputClass}
          value={values.organiser}
          onChange={set('organiser')}
          placeholder="Local community group"
        />
      </Field>
      <Field label="Event date">
        <input className={inputClass} type="date" value={values.eventDate} onChange={set('eventDate')} />
      </Field>
      <Field label="Funding goal (cUSD)">
        <input
          className={inputClass}
          inputMode="decimal"
          value={values.fundingGoalCusd}
          onChange={set('fundingGoalCusd')}
          placeholder="500"
        />
      </Field>
      <Field
        label="Recipient wallet (cUSD)"
        hint="Treasury or organiser EOA on Celo that will receive sponsorships."
      >
        <input
          className={inputClass}
          value={values.recipientAddress}
          onChange={set('recipientAddress')}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {mode === 'admin' ? (
        <>
          <Field label="Verified cleanups so far">
            <input
              className={inputClass}
              inputMode="numeric"
              value={values.verifiedCleanupsCount}
              onChange={set('verifiedCleanupsCount')}
            />
          </Field>
          <Field label="Publish status">
            <select className={inputClass} value={values.status} onChange={set('status')}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          </Field>
        </>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>

      {error ? (
        <p className="text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}
      {done && !hideSuccessMessage ? (
        <p className="text-sm text-brand-green">
          {mode === 'proposal'
            ? 'Submitted for review. Ops will publish it when approved.'
            : 'Event saved and visible on the sponsor page (if upcoming/active).'}
        </p>
      ) : null}
    </form>
  )
}
