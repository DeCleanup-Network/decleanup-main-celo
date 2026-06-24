'use client'

import { Info, Loader2 } from 'lucide-react'
import { TransactionActionBlock } from '@/components/ui/transaction-wait-notice'
import { cn } from '@/lib/utils'

type Props = {
  canRequest: boolean
  pending: boolean
  submitResult?: string
  onRequest: () => void
}

export function HypercertRequestStep({ canRequest, pending, submitResult, onRequest }: Props) {
  const showSuccess = submitResult && !submitResult.startsWith('Error') && !pending

  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="mb-6 font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
        Step 3: Request Hypercert
      </h2>

      <TransactionActionBlock pending={pending} showHint={false}>
        <button
          type="button"
          onClick={onRequest}
          disabled={!canRequest || pending}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full py-4 font-heading text-xl uppercase tracking-widest transition-all disabled:cursor-not-allowed',
            canRequest && !pending
              ? 'border-2 border-brand-yellow bg-brand-yellow text-black hover:border-white hover:bg-white'
              : 'border border-border bg-muted text-muted-foreground opacity-50'
          )}
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Request Hypercert
        </button>
      </TransactionActionBlock>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Data from impact reports filled will flow into your certificate metadata.</span>
      </p>

      {showSuccess ? (
        <p className="mt-4 text-xs text-brand-green" role="status">
          {submitResult}
        </p>
      ) : null}
      {submitResult?.startsWith('Error') ? (
        <p className="mt-4 text-xs text-red-400" role="alert">
          {submitResult}
        </p>
      ) : null}
    </section>
  )
}
