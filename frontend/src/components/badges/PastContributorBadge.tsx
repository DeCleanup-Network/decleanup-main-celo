'use client'

import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  size?: 'sm' | 'md'
}

/** Shown after a past-contributor airdrop is claimed (onchain record in airdrop store). */
export function PastContributorBadge({ className, size = 'sm' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-brand-green/15 to-amber-500/20 font-semibold uppercase tracking-wide text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.15)]',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      title="Early DeCleanup Network supporter — past contributor airdrop claimed"
    >
      <Award className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      Past contributor
    </span>
  )
}
