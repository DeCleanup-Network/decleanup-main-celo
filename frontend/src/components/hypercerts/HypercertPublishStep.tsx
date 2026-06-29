'use client'

import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { cn } from '@/lib/utils'

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
  if (requests.length === 0) return null

  return (
    <section className="rounded-3xl border border-brand-green/30 bg-card p-6 sm:p-8">
      <h2 className="mb-2 font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
        Step 4: Verifier review &amp; publish
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        A DeCleanup verifier approves your request. On approval, your certificate is published to
        Hyperscan automatically — you do not need to publish it yourself.
      </p>

      <ul className="space-y-4">
        {requests.map((request) => {
          const title = request.metadata?.branding?.title || request.metadata?.name || 'Hypercert'
          const hyperscanUrl = request.atUri ? buildHyperscanHypercertUrl(request.atUri) : null
          const isPendingReview = request.status === 'PENDING'
          const isPublishing =
            (request.status === 'APPROVED' || request.status === 'MINTED') && !request.atUri

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

              {isPublishing ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-green" aria-hidden />
                  Approved — publishing to Hyperscan…
                </p>
              ) : null}

              {request.atPublishError ? (
                <p className="mb-3 text-xs text-amber-400" role="status">
                  Publish issue (verifier will retry): {request.atPublishError}
                </p>
              ) : null}

              {!request.atUri && onCancel ? (
                <button
                  type="button"
                  onClick={() => onCancel(request.id)}
                  disabled={!canSign || cancelPending}
                  className={cn(
                    'mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {cancelPending ? 'Withdrawing…' : 'Withdraw request'}
                </button>
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
