import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getSdgOfficialIconUrl, SDG_ALIGNMENT_CARDS } from '@/lib/impact/sdg-mapping'

const PORTFOLIO_SDGS = [11, 14, 15] as const

const SDG_ALIGNMENT_PAGE = 'https://www.decleanup.net/sdg'

function PortfolioSdgCard({ sdgNumber }: { sdgNumber: number }) {
  const meta = SDG_ALIGNMENT_CARDS[sdgNumber]
  if (!meta) return null

  const tooltip = `${meta.fullTitle}. ${meta.description} OUR LINK: ${meta.ourLink}`

  return (
    <a
      href={meta.unUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={tooltip}
      className="group flex aspect-square w-[5.75rem] shrink-0 flex-col items-center justify-between rounded-lg border border-border bg-background/20 p-2 transition-colors hover:border-brand-green/50 sm:w-[6.25rem]"
      aria-label={`SDG ${sdgNumber}: ${meta.fullTitle}. ${meta.description} Opens UN goal description.`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getSdgOfficialIconUrl(sdgNumber)}
        alt=""
        width={72}
        height={72}
        className="h-[3.25rem] w-[3.25rem] rounded-sm object-contain sm:h-14 sm:w-14"
        loading="lazy"
      />
      <div className="mt-1.5 w-full text-center">
        <p className="font-meta text-[9px] uppercase tracking-[0.12em] text-muted-foreground">SDG {sdgNumber}</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-foreground">{meta.name}</p>
      </div>
    </a>
  )
}

export function PortfolioSdgGrid() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2 sm:gap-3">
        {PORTFOLIO_SDGS.map((n) => (
          <PortfolioSdgCard key={n} sdgNumber={n} />
        ))}
      </div>
      <Link
        href={SDG_ALIGNMENT_PAGE}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-brand-green underline underline-offset-2 hover:text-foreground"
      >
        Full SDG alignment
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    </div>
  )
}
