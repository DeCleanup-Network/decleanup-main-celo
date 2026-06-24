'use client'

import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  loading: boolean
  cleanupsCount: number
  reportsCount: number
  timeframeStart?: number
  timeframeEnd?: number
  complete: boolean
}

export function HypercertImpactStep({
  loading,
  cleanupsCount,
  reportsCount,
  timeframeStart,
  timeframeEnd,
  complete,
}: Props) {
  return (
    <section
      className={cn(
        'rounded-3xl border bg-card p-6 sm:p-8',
        complete ? 'border-brand-green/40' : 'border-border'
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
          Step 1: Your impact
        </h2>
        {complete ? <Check className="h-5 w-5 text-brand-green" aria-hidden /> : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-sm">Scanning blockchain for verified impact…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-muted/40 px-6 py-4 text-center">
              <p className="font-heading text-5xl leading-none text-brand-green">{cleanupsCount}</p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Verified cleanups
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-6 py-4 text-center">
              <p className="font-heading text-5xl leading-none text-brand-yellow">{reportsCount}</p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Impact reports
              </p>
            </div>
          </div>
          {timeframeStart && timeframeEnd ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {new Date(timeframeStart).toLocaleDateString()} to{' '}
              {new Date(timeframeEnd).toLocaleDateString()}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
