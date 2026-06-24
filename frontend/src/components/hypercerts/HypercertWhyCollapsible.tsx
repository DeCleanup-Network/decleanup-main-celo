'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Award, ChevronDown, Layers, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS: {
  icon: typeof Award
  label: string
  body: ReactNode
}[] = [
  {
    icon: Award,
    label: 'Public proof',
    body: (
      <>
        Your certificate appears on{' '}
        <Link
          href="https://www.hyperscan.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-green underline underline-offset-2 hover:text-foreground"
        >
          Hyperscan
        </Link>{' '}
        with a permanent link to share with sponsors or employers.
      </>
    ),
  },
  {
    icon: Layers,
    label: 'Milestone proof',
    body: 'A Hypercert bundles a batch of verified cleanups into one credential, stronger for portfolios and fundraising.',
  },
  {
    icon: ShieldCheck,
    label: 'Verifier-backed',
    body: 'A DeCleanup Network verifier approves your request before it publishes, so the certificate carries real weight.',
  },
]

export function HypercertPoweredBy() {
  return (
    <div className="flex flex-col items-center pt-4">
      <a
        href="https://hypercerts.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-meta flex items-center justify-center gap-2 opacity-50 transition-opacity hover:opacity-80"
      >
        <span>Powered by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hypercerts-logo.png" alt="" className="h-5 w-5 rounded-sm sm:h-6 sm:w-6" />
        <span className="font-heading text-xs uppercase tracking-wide text-foreground">Hypercerts</span>
      </a>
    </div>
  )
}

export function HypercertWhyCollapsible() {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-4 text-left sm:px-6"
        aria-expanded={open}
      >
        <span className="font-heading text-sm uppercase tracking-wider text-foreground">
          Why get a Hypercert?
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="grid gap-6 border-t border-border px-4 pb-6 pt-5 sm:grid-cols-3 sm:px-6">
          {ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="space-y-2">
                <Icon className="h-5 w-5 text-brand-green" aria-hidden />
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
