'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { Button } from '@/components/ui/button'
import { SponsorEventForm, type EventFormValues } from '@/components/sponsor/SponsorEventForm'
import type { SponsorEventDto } from '@/lib/sponsor/types'

function short(a: string) {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

export function SponsorAdminPanel() {
  const { address, isConnected } = useAccount()
  const { connectAsync, connectors, isPending } = useConnect()
  const [adminSecret, setAdminSecret] = useState('')
  const [pending, setPending] = useState<SponsorEventDto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const adminHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (adminSecret.trim()) h['x-sponsor-admin-secret'] = adminSecret.trim()
    if (address) h['x-sponsor-admin-wallet'] = address
    return h
  }, [adminSecret, address])

  const loadPending = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/sponsor/events?status=pending', {
        headers: adminHeaders,
        cache: 'no-store',
      })
      const data = (await res.json()) as { events?: SponsorEventDto[]; error?: string }
      if (!res.ok) {
        setLoadError(data.error || 'Not authorized to list pending')
        setPending([])
        return
      }
      setPending(data.events || [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Load failed')
    }
  }, [adminHeaders])

  useEffect(() => {
    if (isConnected || adminSecret.trim()) void loadPending()
  }, [isConnected, adminSecret, loadPending])

  const connect = async () => {
    const c =
      connectors.find((x) => x.id === 'injected' || x.type === 'injected') ||
      connectors.find((x) => x.id === 'walletConnect')
    if (!c) return
    await connectAsync({ connector: c })
  }

  const createPublished = async (values: EventFormValues) => {
    const res = await fetch('/api/sponsor/events', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: values.name,
        location: values.location,
        organiser: values.organiser,
        eventDate: values.eventDate,
        fundingGoalCusd: Number(values.fundingGoalCusd),
        recipientAddress: values.recipientAddress,
        verifiedCleanupsCount: Number(values.verifiedCleanupsCount) || 0,
        status: values.status === 'pending' ? 'upcoming' : values.status,
        asProposal: false,
        walletAddress: address || undefined,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Create failed')
    setMsg('Event published.')
    void loadPending()
  }

  const setStatus = async (id: string, status: 'upcoming' | 'active' | 'ended') => {
    setMsg(null)
    const res = await fetch(`/api/sponsor/events/${id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status, walletAddress: address || undefined }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setMsg(data.error || 'Update failed')
      return
    }
    setMsg(`Updated to ${status}.`)
    void loadPending()
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6 sm:px-5">
      <div>
        <BackToDeCleanupLink className="mr-3" />
        <Link href="/sponsor" className="text-xs text-gray-500 hover:text-brand-green hover:underline">
          ← Sponsor page
        </Link>
        <h1 className="mt-2 font-heading text-2xl tracking-wider text-white">Event admin</h1>
        <p className="mt-1 text-sm text-gray-400">
          Publish events or approve community proposals. Allowlisted wallets or admin secret.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
        <h2 className="font-heading text-xs tracking-wider text-gray-500">Access</h2>
        {!isConnected ? (
          <Button type="button" className="w-full" disabled={isPending} onClick={() => void connect()}>
            {isPending ? 'Connecting…' : 'Connect admin wallet'}
          </Button>
        ) : (
          <p className="text-sm text-gray-300">{short(address!)}</p>
        )}
        <label className="block space-y-1.5">
          <span className="text-xs text-gray-400">Admin secret (optional)</span>
          <input
            type="password"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green/50"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="SPONSOR_ADMIN_SECRET"
            autoComplete="off"
          />
        </label>
      </section>

      <section className="rounded-xl border border-white/10 bg-zinc-950/80 p-4">
        <h2 className="mb-3 font-heading text-xs tracking-wider text-gray-500">Publish event</h2>
        <SponsorEventForm mode="admin" submitLabel="Publish event" onSubmit={createPublished} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-xs tracking-wider text-gray-500">Pending proposals</h2>
          <button type="button" className="text-xs text-brand-green hover:underline" onClick={() => void loadPending()}>
            Refresh
          </button>
        </div>
        {loadError ? <p className="text-sm text-amber-200">{loadError}</p> : null}
        {pending.length === 0 && !loadError ? (
          <p className="text-sm text-gray-500">No pending proposals.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((ev) => (
              <li key={ev.id} className="rounded-xl border border-white/10 bg-zinc-950/80 p-3">
                <p className="font-medium text-white">{ev.name}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {ev.location} · {ev.organiser} · {ev.fundingGoalCusd} cUSD
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  To {short(ev.recipientAddress)}
                  {ev.submittedBy ? ` · by ${short(ev.submittedBy)}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void setStatus(ev.id, 'upcoming')}>
                    Approve upcoming
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/10"
                    onClick={() => void setStatus(ev.id, 'active')}
                  >
                    Make active
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void setStatus(ev.id, 'ended')}
                  >
                    Reject / end
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg ? <p className="text-sm text-brand-green">{msg}</p> : null}
    </div>
  )
}
