import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const decleanupRewardsTitleStyle = {
  fontFamily: 'var(--font-space-grotesk), var(--font-inter), sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 0.92,
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
 * Shared program hero: gradient DECLEANUP + Space Grotesk display + Inter body.
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
          <h1
            className="font-bebas text-4xl leading-none tracking-wider sm:text-5xl md:text-6xl"
            style={decleanupRewardsTitleStyle}
          >
            <span className="gradient-text">DECLEANUP</span>{' '}
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
