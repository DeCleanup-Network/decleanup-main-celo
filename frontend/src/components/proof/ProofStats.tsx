import type { ProofStat } from '@/lib/proof/display'

export function ProofStats({ stats }: { stats: ProofStat[] }) {
  if (stats.length === 0) return null
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-white/10 bg-elevated px-4 py-3"
        >
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 break-words font-heading text-xl leading-tight text-foreground">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
