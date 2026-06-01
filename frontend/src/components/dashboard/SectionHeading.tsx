'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { IconAccent } from '@/components/ui/icon-accent'
import { cn } from '@/lib/utils'

export type SectionHeadingProps = {
  icon: LucideIcon
  children: ReactNode
  /** Optional right side (e.g. “How to earn”, links) — stacks below title on narrow screens */
  aside?: ReactNode
  className?: string
}

/**
 * Impact Product card title row: yellow accent icon + display heading.
 */
export function SectionHeading({ icon: Icon, children, aside, className }: SectionHeadingProps) {
  const title = (
    <>
      <IconAccent icon={Icon} tone="yellow" size="sm" />
      <h2 className="font-plakat text-xl text-foreground sm:text-2xl">{children}</h2>
    </>
  )

  if (aside) {
    return (
      <div
        className={cn(
          'mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">{title}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{aside}</div>
      </div>
    )
  }

  return <div className={cn('mb-4 flex shrink-0 items-center gap-2', className)}>{title}</div>
}
