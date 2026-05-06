import type { ReactNode } from 'react'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

const bebasHeadingStyle = {
  fontFamily: 'var(--font-bebas-neue), sans-serif',
  letterSpacing: '0.05em',
} as const

export type DeCleanupPageHeroProps = {
  /** Uppercase line after the gradient mark, e.g. "HYPERCERTS", "LEADERBOARD". */
  programWord: string
  /** Optional narrow label above the main title. */
  pageTagline?: string
  description: ReactNode
  /** Header actions (back, Home, wallet) — aligned to the end on large screens. */
  trailing?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/**
 * Shared program hero: matches the logged-in dashboard (gradient DECLEANUP + Bebas + muted body).
 */
export function DeCleanupPageHero({
  programWord,
  pageTagline,
  description,
  trailing,
  align = 'left',
  className,
}: DeCleanupPageHeroProps) {
  const textBlock = align === 'center' ? 'text-center mx-auto' : 'text-center sm:text-left'

  return (
    <header className={cn('min-w-0 space-y-4 border-b border-border pb-8 sm:pb-10', className)}>
      <div
        className={cn(
          'flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between',
          align === 'center' && 'lg:flex-col lg:items-center'
        )}
      >
        <div className={cn('max-w-3xl space-y-3', textBlock)}>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-green">
            <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden />
            DeCleanup Network
          </div>
          {pageTagline ? (
            <p className="font-bebas text-xs uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">{pageTagline}</p>
          ) : null}
          <h1
            className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl"
            style={bebasHeadingStyle}
          >
            <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent">
              DECLEANUP
            </span>{' '}
            <span className="text-foreground">{programWord}</span>
          </h1>
          <div className="font-sans text-sm text-muted-foreground sm:text-base">{description}</div>
        </div>
        {trailing ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-2',
              align === 'center' ? 'justify-center' : 'justify-start lg:justify-end'
            )}
          >
            {trailing}
          </div>
        ) : null}
      </div>
    </header>
  )
}
