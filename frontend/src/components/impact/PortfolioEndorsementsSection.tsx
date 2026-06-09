'use client'

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Loader2, Quote, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import {
  ENDORSEMENT_LIMITS,
  buildEndorsementSignMessage,
  sanitizeEndorsementInput,
  type PortfolioEndorsement,
} from '@/lib/impact/portfolio-endorsements'
import type { Address } from 'viem'

type Props = {
  portfolioAddress: Address
  endorsements: PortfolioEndorsement[]
  onEndorsementSaved: (endorsement: PortfolioEndorsement) => void
}

export function PortfolioEndorsementsSection({
  portfolioAddress,
  endorsements,
  onEndorsementSaved,
}: Props) {
  const { address: connectedAddress } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [showForm, setShowForm] = useState(false)
  const [endorserName, setEndorserName] = useState('')
  const [endorserOrg, setEndorserOrg] = useState('')
  const [statement, setStatement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEndorse =
    connectedAddress &&
    connectedAddress.toLowerCase() !== portfolioAddress.toLowerCase()

  const submit = async () => {
    if (!connectedAddress || !signMessageAsync) {
      setError('Connect a wallet to endorse this portfolio.')
      return
    }
    const fields = sanitizeEndorsementInput({ endorserName, endorserOrg, statement })
    if (!fields.statement) {
      setError('Write a short endorsement statement.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const timestamp = Date.now()
      const message = buildEndorsementSignMessage({
        portfolioAddress,
        endorserAddress: connectedAddress as Address,
        ...fields,
        timestamp,
      })
      const signature = await signMessageAsync({ message })
      const res = await fetch('/api/impact/endorsements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioAddress,
          endorserAddress: connectedAddress,
          ...fields,
          timestamp,
          signature,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to save endorsement')
      }
      onEndorsementSaved(payload.endorsement as PortfolioEndorsement)
      setShowForm(false)
      setStatement('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to endorse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-meta text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Endorsements</p>
          <h2 className="mt-1 font-heading text-xl tracking-wider">Third-party endorsements</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Signed statements from partners, funders, or community orgs (wallet signature required).
          </p>
        </div>
        {canEndorse ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Endorse portfolio'}
          </Button>
        ) : null}
      </div>

      {showForm && canEndorse ? (
        <div className="mt-4 space-y-3 rounded-md border border-border/60 p-3">
          <label className="block text-xs">
            <span className="text-muted-foreground">Your name</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={endorserName}
              maxLength={ENDORSEMENT_LIMITS.endorserName}
              onChange={(e) => setEndorserName(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Organization (optional)</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={endorserOrg}
              maxLength={ENDORSEMENT_LIMITS.endorserOrg}
              onChange={(e) => setEndorserOrg(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Endorsement statement</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={statement}
              maxLength={ENDORSEMENT_LIMITS.statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <Button type="button" size="sm" disabled={loading} onClick={() => void submit()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              'Sign endorsement'
            )}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {endorsements.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/80 bg-background/30 p-4 text-sm text-muted-foreground">
            No endorsements yet. Partners can connect a wallet and submit a signed statement.
          </div>
        ) : (
          endorsements.map((e) => (
            <article key={e.id} className="rounded-md border border-border/60 p-4">
              <div className="flex items-start gap-2">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-foreground">{e.statement}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.endorserName}
                    {e.endorserOrg ? ` · ${e.endorserOrg}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <CopyableAddress address={e.endorserAddress} truncate className="font-mono" />
                    <span className="inline-flex items-center gap-1 text-brand-green">
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      Signed
                    </span>
                    <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
