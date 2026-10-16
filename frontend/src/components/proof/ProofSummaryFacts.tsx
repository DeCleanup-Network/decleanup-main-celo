import { splitSummaryFacts } from '@/lib/proof/display'

export function ProofSummaryFacts({ summary }: { summary?: string | null }) {
  const facts = splitSummaryFacts(summary)
  if (facts.length === 0) return null
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {facts.map((fact, index) => (
        <li
          key={`${index}-${fact}`}
          className="rounded-xl border border-white/10 bg-elevated px-4 py-3 text-sm leading-relaxed text-foreground sm:text-base"
        >
          {fact}
        </li>
      ))}
    </ul>
  )
}

export function ProofWasteTypes({ types }: { types: string[] }) {
  if (types.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {types.map((type) => (
        <li
          key={type}
          className="rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-sm text-foreground"
        >
          {type}
        </li>
      ))}
    </ul>
  )
}
