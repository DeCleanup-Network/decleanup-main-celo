import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StatusChipProps = {
  children: ReactNode
  /** live = green pulse dot; pilot = yellow; neutral = gray */
  variant?: 'live' | 'pilot' | 'neutral'
  className?: string
}

/**
 * Landing-style eyebrow chip (mono label + status dot).
 */
export function StatusChip({ children, variant = 'neutral', className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'status-chip font-meta inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-elevated/80 px-2.5 py-1 text-[10px] text-muted-foreground',
        variant === 'pilot' && 'status-chip-pilot text-brand-yellow',
        variant === 'live' && 'text-brand-green',
        className
      )}
    >
      <span
        className={cn(
          'status-chip-dot',
          variant === 'live' && 'bg-brand-green',
          variant === 'pilot' && 'bg-brand-yellow',
          variant === 'neutral' && 'bg-muted-foreground/60'
        )}
        aria-hidden
      />
      {children}
    </span>
  )
}
