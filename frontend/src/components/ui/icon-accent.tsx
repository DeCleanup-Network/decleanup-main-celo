'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type IconAccentProps = {
  icon: LucideIcon
  /** yellow = section headers; green = live / success */
  tone?: 'yellow' | 'green' | 'muted'
  size?: 'sm' | 'md'
  className?: string
}

const toneClass = {
  yellow: 'text-brand-yellow icon-accent-ring-yellow',
  green: 'text-brand-green icon-accent-ring-green',
  muted: 'text-muted-foreground icon-accent-ring-muted',
} as const

/**
 * Lucide icon in a soft ring — landing “chip dot” energy for dashboard sections.
 */
export function IconAccent({ icon: Icon, tone = 'yellow', size = 'md', className }: IconAccentProps) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={cn(
        'icon-accent inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-elevated',
        box,
        toneClass[tone],
        className
      )}
      aria-hidden
    >
      <Icon className={iconSize} strokeWidth={2} />
    </span>
  )
}
