type Props = {
  impactContext: string
  additionalityStatement: string
}

export function PortfolioImpactNarrative({ impactContext, additionalityStatement }: Props) {
  if (!impactContext.trim() && !additionalityStatement.trim()) {
    return (
      <section className="rounded-xl border border-dashed border-border/80 bg-background/30 p-4">
        <p className="font-meta text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Impact narrative
        </p>
        <h2 className="mt-1 font-heading text-xl tracking-wider">Why this matters here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add local context and a baseline / additionality statement via Edit profile. Funders and CSR teams use this
          to quote impact beyond raw activity metrics.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="font-meta text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Impact narrative</p>
      <h2 className="mt-1 font-heading text-xl tracking-wider">Why this matters here</h2>
      {impactContext.trim() ? (
        <div className="mt-4 rounded-md border border-border/60 p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Local context</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{impactContext.trim()}</p>
        </div>
      ) : null}
      {additionalityStatement.trim() ? (
        <div className="mt-3 rounded-md border border-border/60 p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Baseline &amp; additionality
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{additionalityStatement.trim()}</p>
        </div>
      ) : null}
    </section>
  )
}
