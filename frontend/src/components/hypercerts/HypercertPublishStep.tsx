'use client'

import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { TransactionActionBlock } from '@/components/ui/transaction-wait-notice'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { cn } from '@/lib/utils'

type Props = {
  requests: HypercertRequest[]
  canSign: boolean
  pending: boolean
  publishResult?: string
  onPublish: (requestId: string) => void
  onCancel?: (requestId: string) => void
  cancelPending?: boolean
}

export function HypercertPublishStep({
  requests,
  canSign,
  pending,
  publishResult,
  onPublish,
  onCancel,
  cancelPending,
}: Props) {
  if (requests.length === 0) return null

  return (
    <section className="rounded-3xl border border-brand-green/30 bg-card p-6 sm:p-8">
      <h2 className="mb-2 font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
        Step 4: Publish to Hyperscan
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Your request was approved. Sign once to authorize publishing your certificate on Hyperscan (AT Protocol).
      </p>

      <ul className="space-y-4">
        {requests.map((request) => {
          const title = request.metadata?.branding?.title || request.metadata?.name || 'Hypercert'
          const hyperscanUrl = request.atUri ? buildHyperscanHypercertUrl(request.atUri) : null

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

              {request.atPublishError ? (
                <p className="mb-3 text-xs text-amber-400" role="status">
                  Last publish attempt failed: {request.atPublishError}
                </p>
              ) : null}

              {!request.atUri ? (
                <TransactionActionBlock pending={pending} showHint={false}>
                  <button
                    type="button"
                    onClick={() => onPublish(request.id)}
                    disabled={!canSign || pending || cancelPending}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-full py-3 font-heading text-lg uppercase tracking-widest transition-all disabled:cursor-not-allowed',
                      canSign && !pending && !cancelPending
                        ? 'border-2 border-brand-green bg-brand-green text-black hover:border-white hover:bg-white'
                        : 'border border-border bg-muted text-muted-foreground opacity-50'
                    )}
                  >
                    {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                    Publish Hypercert
                  </button>
                  {onCancel ? (
                    <button
                      type="button"
                      onClick={() => onCancel(request.id)}
                      disabled={!canSign || pending || cancelPending}
                      className="mt-2 w-full text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancelPending ? 'Withdrawing…' : 'Withdraw and start over'}
                    </button>
                  ) : null}
                </TransactionActionBlock>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Your certificate is stored on-chain via AT Protocol and appears on{' '}
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

      {publishResult && !pending ? (
        <p
          className={cn('mt-4 text-xs', publishResult.startsWith('Error') ? 'text-red-400' : 'text-brand-green')}
          role={publishResult.startsWith('Error') ? 'alert' : 'status'}
        >
          {publishResult}
        </p>
      ) : null}
    </section>
  )
}
