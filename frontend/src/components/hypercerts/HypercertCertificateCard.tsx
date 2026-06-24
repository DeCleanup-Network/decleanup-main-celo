'use client'

import Link from 'next/link'
import { ExternalLink, Layers } from 'lucide-react'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { extractImpactSummaryFromMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'

function ipfsRefToUrl(ref?: string): string | null {
  if (!ref || ref.includes('QmPlaceholder')) return null
  const hash = ref.startsWith('ipfs://') ? ref.replace('ipfs://', '') : ref
  return getIPFSUrl(hash)
}

function hypercertArtUrl(request: HypercertRequest): string | null {
  const banner = request.metadata?.branding?.bannerImageCid
  if (banner) return ipfsRefToUrl(banner)
  const logo = request.metadata?.branding?.logoImageCid
  if (logo) return ipfsRefToUrl(logo)
  return ipfsRefToUrl(request.metadata?.image)
}

type Props = {
  request: HypercertRequest
}

export function HypercertCertificateCard({ request }: Props) {
  const artUrl = hypercertArtUrl(request)
  const summary = extractImpactSummaryFromMetadata(request.metadata)
  const title = request.metadata?.name || 'Environmental Impact Certificate'
  const description = request.metadata?.description
  const timeframe = request.metadata?.hypercert?.work_timeframe?.display_value
  const hyperscanUrl = request.atUri ? buildHyperscanHypercertUrl(request.atUri) : null

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/7] w-full bg-muted/30">
        {artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- IPFS gateway URLs are dynamic
          <img src={artUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-background px-6 py-10 text-center">
            <Layers className="h-10 w-10 text-brand-green/80" aria-hidden />
            <p className="font-heading text-sm uppercase tracking-widest text-foreground/80">
              DeCleanup Hypercert
            </p>
            <p className="text-xs text-muted-foreground">
              Add a cover image on your next request for a custom banner.
            </p>
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full border border-brand-green bg-background px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-brand-green">
          Published
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="font-heading text-lg uppercase tracking-wide text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cleanups</p>
            <p className="font-heading text-xl text-brand-green">{summary.totalCleanups}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reports</p>
            <p className="font-heading text-xl text-brand-yellow">{summary.totalReports}</p>
          </div>
          {timeframe ? (
            <div className="col-span-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Period</p>
              <p className="mt-0.5 text-[11px] leading-tight text-foreground">{timeframe}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {hyperscanUrl ? (
            <Link
              href={hyperscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/15 px-3 py-1.5 font-medium text-brand-green hover:text-foreground"
            >
              View on Hyperscan
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          ) : (
            <span className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted-foreground">
              AT certificate publishing…
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
