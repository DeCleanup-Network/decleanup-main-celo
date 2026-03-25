'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { isAddress } from 'viem'
import type { Address } from 'viem'
import {
  Loader2,
  Share2,
  Leaf,
  Droplets,
  Scale,
  Clock,
  Award,
  TrendingUp,
  Users,
  Flame,
  FileText,
  Shield,
  Sparkles,
  Link2,
} from 'lucide-react'
import { resolveEnsToAddress, resolveAddressToEnsName } from '@/lib/utils/ens'
import {
  fetchPublicPortfolioData,
  hashToProxyDisplayUrl,
  canShowPhoto,
  type PublicPortfolioPayload,
} from '@/lib/impact/public-portfolio-data'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'

function formatNum(n: number, d = 1) {
  if (!Number.isFinite(n)) return '0'
  return n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(d)
}

function WasteBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, c]) => c))
  if (entries.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-green/80">Waste focus (by cleanups)</p>
      <div className="space-y-2">
        {entries.map(([label, c]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs text-foreground/90">
              <span>{label}</span>
              <span className="text-muted-foreground">{c}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#58B12F] to-[#FAFF00] transition-all"
                style={{ width: `${(c / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PublicPortfolioContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const raw = typeof params?.address === 'string' ? params.address : ''

  const saParam = searchParams.get('sa') || searchParams.get('submissionOwner')
  const submissionOwnerOverride = useMemo(() => {
    if (!saParam?.trim()) return undefined
    const t = saParam.trim()
    return isAddress(t) ? (t as Address) : undefined
  }, [saParam])

  const [resolved, setResolved] = useState<Address | null>(null)
  const [ensName, setEnsName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicPortfolioPayload | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const resolveParam = useCallback(async () => {
    const trimmed = decodeURIComponent(raw).trim()
    if (!trimmed) {
      setResolved(null)
      setError('Missing address')
      return
    }
    if (isAddress(trimmed)) {
      setResolved(trimmed as Address)
      setError(null)
      return
    }
    const addr = await resolveEnsToAddress(trimmed)
    if (addr && isAddress(addr)) {
      setResolved(addr as Address)
      setError(null)
    } else {
      setResolved(null)
      setError('Could not resolve ENS or invalid address')
    }
  }, [raw])

  useEffect(() => {
    void resolveParam()
  }, [resolveParam])

  useEffect(() => {
    if (!resolved) return
    let cancelled = false
    void resolveAddressToEnsName(resolved).then((n) => {
      if (!cancelled) setEnsName(n)
    })
    return () => {
      cancelled = true
    }
  }, [resolved])

  useEffect(() => {
    if (!resolved) {
      if (!error) setLoading(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const payload = await fetchPublicPortfolioData(resolved, {
          submissionOwner: submissionOwnerOverride,
        })
        if (!cancelled) setData(payload)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portfolio')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolved, submissionOwnerOverride])

  const shareUrl =
    typeof window !== 'undefined' && resolved
      ? `${window.location.origin}/impact/${resolved}${submissionOwnerOverride ? `?sa=${submissionOwnerOverride}` : ''}`
      : ''

  const copyShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // ignore
    }
  }

  const shareOnX = () => {
    if (!shareUrl) return
    const text = encodeURIComponent('View my DeCleanup Impact Portfolio')
    const url = encodeURIComponent(shareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareOnFarcaster = () => {
    if (!shareUrl) return
    const text = encodeURIComponent(`View my DeCleanup Impact Portfolio\n\n${shareUrl}`)
    window.open(`https://warpcast.com/~/compose?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const reward = data?.rewards

  const heroTitleStyle = {
    fontFamily: 'var(--font-bebas-neue), sans-serif',
    letterSpacing: '0.05em',
    lineHeight: 1.1,
  } as const

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:py-8">
          <div className="space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-green sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.25em]">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Verified impact · ESG disclosure
            </div>
            <h1
              className="font-bebas text-3xl leading-none tracking-wider text-foreground sm:text-5xl md:text-6xl"
              style={heroTitleStyle}
            >
              <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent animate-pulse">
                Impact
              </span>{' '}
              Portfolio
            </h1>
            {resolved && (
              <div className="space-y-1">
                {ensName && (
                  <p className="font-sans text-lg font-semibold text-brand-green sm:text-xl">{ensName}</p>
                )}
                <div className="max-w-full sm:max-w-2xl">
                  <CopyableAddress
                    address={resolved}
                    truncate={false}
                    className="text-[11px] text-muted-foreground sm:text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button asChild variant="outline" size="sm" className="border-border bg-card font-bebas tracking-wider text-foreground hover:bg-muted">
              <Link href="/">Home</Link>
            </Button>
            {shareUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-brand-green/40 bg-brand-green/10 font-bebas tracking-wider text-brand-green hover:bg-brand-green/20"
                  onClick={() => void copyShare()}
                >
                  <Share2 className="mr-2 h-4 w-4 shrink-0" />
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border bg-card font-bebas tracking-wider text-foreground hover:bg-muted"
                  onClick={shareOnX}
                >
                  Share on X
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border bg-card font-bebas tracking-wider text-foreground hover:bg-muted"
                  onClick={shareOnFarcaster}
                >
                  Share on Farcaster
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:space-y-10 sm:py-12">
        {error && !resolved && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="h-12 w-12 animate-spin text-brand-green" />
            <p className="text-sm text-muted-foreground">Loading statistics</p>
          </div>
        )}

        {!loading && data && reward && (
          <>
            {/* KPI strip — compact 2×2 on mobile so first screen fits summary cards */}
            <section className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              {[
                {
                  label: 'DCU recognized',
                  value: formatNum(reward.totalDcuBreakdown, 0),
                  sub: 'Sum of categories below',
                  icon: TrendingUp,
                  accent: 'from-brand-green/15 to-brand-green/5',
                },
                {
                  label: 'Verified cleanups',
                  value: String(data.verifiedCleanups),
                  sub: data.aggregated
                    ? `${new Date(data.aggregated.timeframeStart).toLocaleDateString()} – ${new Date(data.aggregated.timeframeEnd).toLocaleDateString()}`
                    : '—',
                  icon: Leaf,
                  accent: 'from-brand-green/10 to-transparent',
                },
                {
                  label: 'Impact reports',
                  value: String(data.verifiedWithReport),
                  sub: 'Structured reports',
                  icon: FileText,
                  accent: 'from-brand-yellow/10 to-transparent',
                },
                {
                  label: 'Impact Product',
                  value: data.level > 0 ? `Lv ${data.level}` : '—',
                  sub: 'NFT',
                  icon: Award,
                  accent: 'from-brand-yellow/15 to-brand-green/5',
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className={`relative min-h-0 overflow-hidden rounded-xl border border-border bg-card bg-gradient-to-br ${k.accent} p-3 shadow-md shadow-black/15 sm:rounded-2xl sm:p-5 sm:shadow-lg`}
                >
                  <k.icon className="absolute right-2 top-2 h-5 w-5 text-brand-green/15 sm:right-3 sm:top-3 sm:h-8 sm:w-8" />
                  <p className="pr-6 text-[9px] font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground sm:pr-8 sm:text-[10px] sm:tracking-[0.2em]">
                    {k.label}
                  </p>
                  <p className="mt-1 font-bebas text-2xl leading-none text-foreground sm:mt-2 sm:text-4xl">{k.value}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground sm:mt-1 sm:text-[11px]">{k.sub}</p>
                </div>
              ))}
            </section>

            {/* Rewards breakdown — second “screen” on mobile */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-8">
              <h2 className="font-bebas text-xl tracking-wider text-brand-green sm:text-3xl">Rewards breakdown (DCU)</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Category totals recorded for this profile.</p>
              <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                {[
                  { label: 'Cleanups', value: reward.cleanupsDCU, icon: TrendingUp },
                  { label: 'Referrals', value: reward.referralsDCU, icon: Users },
                  { label: 'Streak', value: reward.streakDCU, icon: Flame },
                  { label: 'Reports', value: reward.reportsDCU, icon: FileText },
                  { label: 'Hypercerts', value: reward.hypercertsDCU, icon: Leaf },
                  { label: 'Verifier', value: reward.verifierDCU, icon: Shield },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2.5 sm:rounded-xl sm:px-4 sm:py-3"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs text-foreground/90 sm:text-sm">
                      <row.icon className="h-3.5 w-3.5 shrink-0 text-brand-green sm:h-4 sm:w-4" />
                      {row.label}
                    </span>
                    <span className="shrink-0 font-bebas text-lg text-foreground sm:text-xl">{formatNum(row.value, 0)}</span>
                  </div>
                ))}
              </div>
              {data.contributorCleanupCount > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  <Users className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                  Contributor credit on {data.contributorCleanupCount} other cleanup(s); attribution only, no DCU.
                </p>
              )}
            </section>

            {/* Environmental metrics — compact block */}
            <section className="grid gap-4 lg:grid-cols-12 lg:gap-6">
              <div className="space-y-3 lg:col-span-5">
                <h2 className="font-bebas text-xl tracking-wider text-foreground sm:text-3xl">Cumulative environmental impact</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">From verified impact reports (IPFS).</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    { icon: Droplets, label: 'Area (est.)', value: `${formatNum(data.cumulative.areaSqm, 0)} m²`, color: 'text-cyan-400' },
                    { icon: Scale, label: 'Weight (est.)', value: `${formatNum(data.cumulative.weightKg, 1)} kg`, color: 'text-brand-yellow' },
                    { icon: Leaf, label: 'Bags', value: formatNum(data.cumulative.bagsTotal, 0), color: 'text-brand-green' },
                    { icon: Clock, label: 'Time (est.)', value: `${Math.round(data.cumulative.minutesTotal / 60)} h`, color: 'text-violet-300' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl border border-border bg-card p-3 sm:rounded-2xl sm:p-4">
                      <m.icon className={`mb-1 h-5 w-5 sm:mb-2 sm:h-6 sm:w-6 ${m.color}`} />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-widest">{m.label}</p>
                      <p className="mt-0.5 font-bebas text-xl text-foreground sm:mt-1 sm:text-2xl">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card bg-gradient-to-br from-brand-green/5 to-transparent p-4 sm:rounded-3xl sm:p-6 lg:col-span-7">
                <WasteBars counts={data.cumulative.wasteTypeCounts} />
              </div>
            </section>

            {/* Impact Product visual: onchain NFT; image from token URI or IPFS fallback */}
            {data.level > 0 && (
              <section className="overflow-hidden rounded-3xl border border-border bg-card">
                <div className="grid md:grid-cols-2">
                  <div className="relative aspect-square border-b border-border md:border-b-0 md:border-r md:border-border md:aspect-auto md:min-h-[320px]">
                    {data.impactProductImageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={data.impactProductImageUrl}
                          alt={`Impact Product level ${data.level}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="flex h-full min-h-[240px] items-center justify-center bg-muted/50">
                        <Award className="h-16 w-16 text-brand-green/40" />
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 right-4">
                      <p
                        className="font-bebas text-3xl leading-none tracking-wider drop-shadow-lg sm:text-4xl"
                        style={heroTitleStyle}
                      >
                        <span className="bg-gradient-to-r from-[#58B12F] via-[#FAFF00] to-[#58B12F] bg-clip-text text-transparent">
                          Impact
                        </span>
                        <span className="text-white"> Product</span>
                      </p>
                      <p className="mt-1 text-sm text-white/80">Level {data.level}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center p-6 sm:p-8">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      This asset represents verified cleanup progression in the DeCleanup Network.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
                        Field verified
                      </span>
                      <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Open metadata
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Cleanup gallery + reports */}
            <section className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-bebas text-2xl tracking-wider text-foreground sm:text-3xl">Cleanup evidence & reports</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Photo previews respect your per-photo consent from the impact report.
                  </p>
                </div>
                <Link2 className="hidden h-8 w-8 text-muted-foreground/30 sm:block" />
              </div>

              <div className="space-y-8">
                {data.enriched.map((e) => {
                  const d = e.details
                  const id = e.submissionId
                  const beforeU = d.beforePhotoHash ? hashToProxyDisplayUrl(d.beforePhotoHash) : ''
                  const afterU = d.afterPhotoHash ? hashToProxyDisplayUrl(d.afterPhotoHash) : ''
                  const showBefore = beforeU && canShowPhoto(e.impact, 'before')
                  const showAfter = afterU && canShowPhoto(e.impact, 'after')
                  const im = e.impact
                  return (
                    <article
                      key={id}
                      className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-5 py-4">
                        <span className="font-bebas text-xl tracking-wider text-foreground">Cleanup #{id}</span>
                        <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {d.verified ? 'Verified' : d.rejected ? 'Rejected' : 'Pending'}
                          {d.hasImpactForm ? ' · Report' : ''}
                        </span>
                      </div>

                      {(showBefore || showAfter) && (
                        <div className="grid gap-0 sm:grid-cols-2">
                          {showBefore && (
                            <a
                              href={beforeU}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative block aspect-[4/3] overflow-hidden bg-black/50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={beforeU} alt="Before" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-brand-green">
                                Before
                              </span>
                            </a>
                          )}
                          {showAfter && (
                            <a
                              href={afterU}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative block aspect-[4/3] overflow-hidden bg-black/50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={afterU} alt="After" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-brand-yellow">
                                After
                              </span>
                            </a>
                          )}
                        </div>
                      )}

                      {im && (
                        <div className="space-y-4 p-5 sm:p-6">
                          {im.scopeOfWork && (
                            <p className="text-sm leading-relaxed text-foreground/90">
                              <span className="text-brand-green">Scope: </span>
                              {im.scopeOfWork}
                            </p>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2">
                            {im.environmentalChallenges && (
                              <div className="rounded-xl border border-brand-yellow/25 bg-brand-yellow/5 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-yellow">Challenges</p>
                                <p className="mt-2 text-sm text-foreground/85">{im.environmentalChallenges}</p>
                              </div>
                            )}
                            {im.preventionIdeas && (
                              <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green">Prevention</p>
                                <p className="mt-2 text-sm text-foreground/85">{im.preventionIdeas}</p>
                              </div>
                            )}
                          </div>
                          {im.additionalNotes && (
                            <p className="border-t border-border pt-4 text-sm italic text-muted-foreground">{im.additionalNotes}</p>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

          </>
        )}
      </main>
    </div>
  )
}

export default function PublicImpactPortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-brand-green" />
        </div>
      }
    >
      <PublicPortfolioContent />
    </Suspense>
  )
}
