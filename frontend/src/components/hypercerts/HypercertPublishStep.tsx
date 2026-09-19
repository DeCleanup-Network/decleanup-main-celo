'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import { isAwaitingHypercertPublish } from '@/lib/blockchain/hypercerts/requests'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { Button } from '@/components/ui/button'

type Props = {
  requests: HypercertRequest[]
  canSign: boolean
  cancelPending?: boolean
  onCancel?: (requestId: string) => void
}

export function HypercertPublishStep({
  requests,
  canSign,
  onCancel,
  cancelPending,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (requests.length === 0) return null

  return (
    <section className="rounded-3xl border border-brand-green/30 bg-card p-6 sm:p-8">
      <h2 className="mb-2 font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
        Step 4: Verifier review &amp; publish
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        A DeCleanup Network verifier approves your request. On approval, your certificate should
        publish to Hyperscan automatically. If that step fails, reset and submit again.
      </p>

      <ul className="space-y-4">
        {requests.map((request) => {
          const title = request.metadata?.branding?.title || request.metadata?.name || 'Hypercert'
          const hyperscanUrl = request.atUri ? buildHyperscanHypercertUrl(request.atUri) : null
          const isPendingReview = request.status === 'PENDING'
          const isStalled = isAwaitingHypercertPublish(request)
          const confirming = confirmId === request.id

          return (
            <li key={request.id} className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">Request {request.id.slice(0, 8)}…</p>
                </div>
                {hyperscanUrl ? (
                  <Link
                    href={hyperscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-green hover:underline"
                  >
                    View on Hyperscan
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </div>

              {isPendingReview ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for verifier review. You will be notified when it is approved and published.
                </p>
              ) : null}

              {isStalled ? (
                <div className="space-y-2">
                  <p className="text-sm text-amber-200">
                    Approved, but not live on Hyperscan. Publish did not finish, so this request is
                    blocking a new one.
                  </p>
                  {request.atPublishError ? (
                    <p className="text-xs text-amber-400/90" role="status">
                      {request.atPublishError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Usually the AT login on the server failed, or Hyperscan publish is turned off.
                    </p>
                  )}
                </div>
              ) : null}

              {!isStalled && request.atPublishError ? (
                <p className="mb-3 text-xs text-amber-400" role="status">
                  Publish issue: {request.atPublishError}
                </p>
              ) : null}

              {!request.atUri && onCancel ? (
                confirming ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      This withdraws the request so you can configure and submit a new one. Sign in
                      your wallet to confirm.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canSign || cancelPending}
                        onClick={() => onCancel(request.id)}
                      >
                        {cancelPending ? 'Resetting…' : 'Confirm reset'}
                      </Button>
                      <Button
                        type="button"
                        variant="brandGhost"
                        size="sm"
                        disabled={cancelPending}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="brandGhost"
                    size="sm"
                    className="mt-4"
                    disabled={!canSign || cancelPending}
                    onClick={() => setConfirmId(request.id)}
                  >
                    Reset and start over
                  </Button>
                )
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Published certificates appear on{' '}
        <Link
          href="https://www.hyperscan.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-green hover:underline"
        >
          Hyperscan
        </Link>
        .
      </p>
    </section>
  )
}
