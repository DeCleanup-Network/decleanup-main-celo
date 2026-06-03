'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MAX_IMPACT_PRODUCT_LEVEL } from '@/lib/blockchain/chain-constants'
import { cn } from '@/lib/utils'

type ImpactProductLevelHelpProps = {
  className?: string
}

export function ImpactProductLevelHelp({ className }: ImpactProductLevelHelpProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-[11px] font-semibold leading-none text-muted-foreground transition-colors hover:border-brand-yellow/50 hover:bg-brand-yellow/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/50',
          className
        )}
        aria-label="What is Impact Product and how do levels grow?"
      >
        ?
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="impact-product-help-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="impact-product-help-title" className="font-heading text-2xl tracking-wider text-foreground">
                Impact Product
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">What is it?</strong> Your Impact Product is an on-chain NFT tied to
                your account. It proves verified participation in DeCleanup Network and unlocks rewards as you level
                up.
              </p>
              <p>
                <strong className="text-foreground">How do levels grow?</strong> Submit a cleanup, wait for verifier
                approval, then tap <strong className="text-foreground">CLAIM LEVEL</strong> at the top of the page to
                mint (level 1) or upgrade your Impact Product. Each verified cleanup you claim adds one level, up to{' '}
                <strong className="text-foreground">level {MAX_IMPACT_PRODUCT_LEVEL}</strong>.
              </p>
              <p>
                Each time you claim a level you earn{' '}
                <strong className="text-foreground">10 DCU points</strong> toward $cDCU and other program rewards. Higher
                levels reflect more verified cleanups on your record.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
            >
              Got it
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
