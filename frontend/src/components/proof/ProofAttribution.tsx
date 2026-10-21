import { contributorKind } from '@/lib/proof/contributors'
import {
  explorerAddressUrl,
  explorerTxUrl,
  formatProofDateTime,
} from '@/lib/proof/display'
import type { ProofOnchainReview } from '@/lib/proof/onchain-review'

function WalletLink({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className="break-all font-mono text-brand-green hover:underline"
    >
      {address}
    </a>
  )
}

function ContributorValue({ value }: { value: string }) {
  const kind = contributorKind(value)
  if (kind === 'address') return <WalletLink address={value} />
  if (kind === 'email') {
    return (
      <a href={`mailto:${value}`} className="break-all text-brand-green hover:underline">
        {value}
      </a>
    )
  }
  return <span className="break-all">{value}</span>
}

export function ProofAttribution({
  record,
  organizerAddress,
  reviewedAt,
  compact = false,
}: {
  record?: ProofOnchainReview | null
  organizerAddress?: string | null
  reviewedAt?: string | null
  compact?: boolean
}) {
  const organizer = organizerAddress || record?.organizer || null
  const reviewer = record?.reviewer || null
  const when = reviewedAt ? formatProofDateTime(reviewedAt) : ''
  const contributors = record?.contributors ?? []
  const reviewTx = record?.reviewTxHash || null
  const claimTx = record?.claimTxHash || null

  if (!organizer && !reviewer && !when && !reviewTx && !claimTx && contributors.length === 0) {
    return null
  }

  const body = (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {organizer ? (
        <p className="text-sm text-foreground sm:text-base">
          Organized by <WalletLink address={organizer} />
        </p>
      ) : null}
      {reviewer || when ? (
        <p className="text-sm text-foreground sm:text-base">
          {reviewer ? (
            <>
              Reviewed by <WalletLink address={reviewer} />
            </>
          ) : (
            'Reviewed'
          )}
          {when ? <span className="text-muted-foreground">{` · ${when}`}</span> : null}
        </p>
      ) : null}
      {reviewTx ? (
        <p className="text-sm sm:text-base">
          <a
            href={explorerTxUrl(reviewTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green hover:underline"
          >
            Review transaction
          </a>
        </p>
      ) : null}
      {claimTx ? (
        <p className="text-sm sm:text-base">
          <a
            href={explorerTxUrl(claimTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green hover:underline"
          >
            tRWI claim
          </a>
        </p>
      ) : null}
      {contributors.length > 0 ? (
        <div className="text-sm text-foreground sm:text-base">
          <p className="text-muted-foreground">Contributors</p>
          <ul className="mt-1 space-y-0.5">
            {contributors.map((entry) => (
              <li key={entry}>
                <ContributorValue value={entry} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )

  if (compact) return body

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
        Organizer and review
      </h2>
      <div className="rounded-xl border border-white/10 bg-elevated px-4 py-4">{body}</div>
    </section>
  )
}
