'use client'

import { cn } from '@/lib/utils'

type Props = {
  pendingCount: number
  publishingCount: number
  publishedCount: number
}

function Pill({ label, count, active }: { label: string; count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px]',
        active
          ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
          : 'border-border text-muted-foreground'
      )}
    >
      {label}: {count}
    </span>
  )
}

export function HypercertStatusPills({ pendingCount, publishingCount, publishedCount }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill label="Pending review" count={pendingCount} active={pendingCount > 0} />
      <Pill label="Ready to publish" count={publishingCount} active={publishingCount > 0} />
      <Pill label="Published" count={publishedCount} active={publishedCount > 0} />
    </div>
  )
}
