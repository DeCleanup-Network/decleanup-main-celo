import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ProofAiReviewBlock } from '@/components/proof/ProofAiReview'
import { ProofAttribution } from '@/components/proof/ProofAttribution'
import { ProofDonateButton } from '@/components/proof/ProofDonateButton'
import { ProofPhoto } from '@/components/proof/ProofPhoto'
import { ProofStats } from '@/components/proof/ProofStats'
import { ProofSummaryFacts, ProofWasteTypes } from '@/components/proof/ProofSummaryFacts'
import { formatProofDateTime, proofImpactStats, unixSecondsToIso } from '@/lib/proof/display'
import { fetchProofOnchainReview } from '@/lib/proof/onchain-review'
import {
  asWalletAddress,
  explorerTxUrl,
  fetchProofAiReview,
  fetchUsableProofCleanupById,
  proofPublicPhotos,
  wasteTypesFromApi,
} from '@/lib/proof/impact-api'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return buildPageMetadata({
    title: 'Cleanup proof',
    description: 'Verified cleanup record on Celo.',
    path: `/proof/${encodeURIComponent(id)}`,
  })
}

export default async function ProofDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId || '').trim()
  const [cleanup, aiReview, onchainReview] = await Promise.all([
    fetchUsableProofCleanupById(id).catch(() => null),
    fetchProofAiReview(id),
    fetchProofOnchainReview(id, { perIdLogs: true }),
  ])
  if (!cleanup) notFound()
  const reviewedAt =
    unixSecondsToIso(onchainReview?.reviewedAtUnix) ||
    (typeof cleanup.verifiedAt === 'string' ? cleanup.verifiedAt : null)
  const organizerAddress =
    asWalletAddress(cleanup.organizerAddress) ?? onchainReview?.organizer ?? null

  const waste = wasteTypesFromApi(cleanup.impact?.wasteTypes)
  const txHash = cleanup.txHash
  const photos = proofPublicPhotos(cleanup)
  const stats = proofImpactStats(cleanup, { includeZeros: true })
  const verified = formatProofDateTime(cleanup.verifiedAt)
  const hasImpactReport = cleanup.impact?.hasImpactReport === true
  const extraExplorerTx =
    txHash && txHash !== onchainReview?.reviewTxHash && txHash !== onchainReview?.claimTxHash
      ? txHash
      : null

  return (
    <article className="space-y-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/proof" className="text-brand-green hover:underline">
          All cleanups
        </Link>
      </p>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl tracking-wide text-brand-green sm:text-4xl">
          {cleanup.location?.placeName}
        </h1>
        {verified ? <p className="text-sm text-muted-foreground sm:text-base">{verified}</p> : null}
        {cleanup.location?.coordinates ? (
          <p className="text-sm text-muted-foreground">{cleanup.location.coordinates}</p>
        ) : null}
        {hasImpactReport ? (
          <p className="inline-flex rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-xs uppercase tracking-wide text-foreground">
            Impact report
          </p>
        ) : null}
      </header>

      <ProofAttribution
        record={onchainReview}
        organizerAddress={organizerAddress}
        reviewedAt={reviewedAt}
      />

      {organizerAddress ? (
        <ProofDonateButton
          organizerAddress={organizerAddress}
          cleanupId={cleanup.submissionId}
          place={cleanup.location?.placeName}
        />
      ) : null}

      {photos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">Photos</h2>
          <div className={`grid grid-cols-1 gap-4 ${photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {photos.map((photo) => (
              <ProofPhoto key={`${photo.label}-${photo.src}`} src={photo.src} label={photo.label} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">Impact</h2>
        <ProofStats stats={stats} />
      </section>

      {waste.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            Waste types
          </h2>
          <ProofWasteTypes types={waste} />
        </section>
      ) : null}

      {cleanup.summary ? (
        <section className="space-y-3">
          <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            What happened
          </h2>
          <ProofSummaryFacts summary={cleanup.summary} />
        </section>
      ) : null}

      <ProofAiReviewBlock review={aiReview} />

      {extraExplorerTx ? (
        <p>
          <a
            href={explorerTxUrl(extraExplorerTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-green hover:underline"
          >
            View on Celo explorer
          </a>
        </p>
      ) : null}
    </article>
  )
}
