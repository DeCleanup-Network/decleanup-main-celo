import Link from 'next/link'
import { ProofAttribution } from '@/components/proof/ProofAttribution'
import { ProofDonateButton } from '@/components/proof/ProofDonateButton'
import { ProofPhoto } from '@/components/proof/ProofPhoto'
import { ProofStats } from '@/components/proof/ProofStats'
import { ProofWasteTypes } from '@/components/proof/ProofSummaryFacts'
import {
  formatProofDateTime,
  proofGlobalStats,
  proofImpactStats,
  unixSecondsToIso,
} from '@/lib/proof/display'
import {
  asWalletAddress,
  exactApiValue,
  fetchProofGlobal,
  fetchUsableProofCleanups,
  proofPublicPhotos,
  wasteTypesFromApi,
} from '@/lib/proof/impact-api'
import { fetchProofOnchainReview } from '@/lib/proof/onchain-review'

export const dynamic = 'force-dynamic'

export default async function ProofListPage() {
  let globalError: string | null = null
  let listError: string | null = null
  let global: Awaited<ReturnType<typeof fetchProofGlobal>> | null = null
  let cleanups: Awaited<ReturnType<typeof fetchUsableProofCleanups>> = []

  const [globalResult, listResult] = await Promise.allSettled([
    fetchProofGlobal(),
    fetchUsableProofCleanups(),
  ])
  if (globalResult.status === 'fulfilled') global = globalResult.value
  else globalError = globalResult.reason instanceof Error ? globalResult.reason.message : 'Global stats unavailable'
  if (listResult.status === 'fulfilled') cleanups = listResult.value
  else listError = listResult.reason instanceof Error ? listResult.reason.message : 'Cleanup list unavailable'

  const globalStats = proofGlobalStats(global?.metrics)
  const reviews = await Promise.all(
    cleanups.map((cleanup) => fetchProofOnchainReview(cleanup.submissionId))
  )

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl tracking-wide text-brand-green sm:text-4xl">
          Check a cleanup
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          Open a verified Celo cleanup. No account needed.
        </p>
      </header>

      {globalError ? (
        <p className="text-sm text-muted-foreground">{globalError}</p>
      ) : (
        <section aria-labelledby="proof-global-heading" className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Network total</p>
            <h2 id="proof-global-heading" className="font-heading text-xl text-foreground">
              {exactApiValue(global?.project) || 'DeCleanup Network'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Celo
              {global?.last_updated != null
                ? ` · Updated ${formatProofDateTime(global.last_updated)}`
                : ''}
            </p>
          </div>
          <ProofStats stats={globalStats} />
        </section>
      )}

      <section aria-labelledby="proof-list-heading" className="space-y-4">
        <h2 id="proof-list-heading" className="font-heading text-xl text-foreground">
          Verified cleanups
        </h2>
        {listError ? (
          <p className="text-sm text-muted-foreground">{listError}</p>
        ) : cleanups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usable cleanups in this feed.</p>
        ) : (
          <ul className="space-y-4">
            {cleanups.map((cleanup, index) => {
              const waste = wasteTypesFromApi(cleanup.impact?.wasteTypes)
              const stats = proofImpactStats(cleanup)
              const verified = formatProofDateTime(cleanup.verifiedAt)
              const photos = proofPublicPhotos(cleanup)
              const leadPhoto = photos[0]
              const review = reviews[index]
              const reviewedAt =
                unixSecondsToIso(review?.reviewedAtUnix) ||
                (typeof cleanup.verifiedAt === 'string' ? cleanup.verifiedAt : null)
              const organizerAddress =
                asWalletAddress(cleanup.organizerAddress) ?? review?.organizer ?? null
              return (
                <li key={cleanup.submissionId}>
                  <article className="rounded-2xl border border-white/10 bg-elevated p-5">
                  <Link
                    href={`/proof/${encodeURIComponent(cleanup.submissionId)}`}
                    className="block transition-colors hover:border-brand-green/40"
                  >
                    <div
                      className={
                        leadPhoto
                          ? 'grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]'
                          : undefined
                      }
                    >
                      <div>
                        <p className="font-heading text-lg tracking-wide text-foreground sm:text-xl">
                          {cleanup.location?.placeName}
                        </p>
                        {verified ? (
                          <p className="mt-1 text-sm text-muted-foreground">{verified}</p>
                        ) : null}
                        {cleanup.location?.coordinates ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {cleanup.location.coordinates}
                          </p>
                        ) : null}
                        <div className="mt-4 space-y-3">
                          <ProofStats stats={stats} />
                          <ProofWasteTypes types={waste} />
                        </div>
                      </div>
                      {leadPhoto ? (
                        <div className="sm:pt-1">
                          <ProofPhoto src={leadPhoto.src} label={leadPhoto.label} variant="thumb" />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                  <div className="mt-4">
                    <ProofAttribution
                      compact
                      record={review}
                      organizerAddress={organizerAddress}
                      reviewedAt={reviewedAt}
                    />
                  </div>
                  {organizerAddress ? (
                    <div className="mt-4">
                      <ProofDonateButton
                        organizerAddress={organizerAddress}
                        cleanupId={cleanup.submissionId}
                        place={cleanup.location?.placeName}
                      />
                    </div>
                  ) : null}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
