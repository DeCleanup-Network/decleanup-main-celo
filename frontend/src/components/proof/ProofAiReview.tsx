import { exactApiValue, type ProofAiReview } from '@/lib/proof/impact-api'

export function ProofAiReviewBlock({ review }: { review: ProofAiReview | null }) {
  if (!review) return null
  const before = exactApiValue(review.beforeCount)
  const after = exactApiValue(review.afterCount)
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
        AI photo check
      </h2>
      <div className="rounded-xl border border-white/10 bg-elevated px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground sm:text-base">{review.summary}</p>
        {before !== '' && after !== '' ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Detected items: before {before} · after {after}
          </p>
        ) : null}
      </div>
    </section>
  )
}
