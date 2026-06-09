import Link from 'next/link'
import { ExternalLink, Layers } from 'lucide-react'
import type { PortfolioHypercertRecord } from '@/lib/impact/public-portfolio-data'

type Props = {
  hypercerts: PortfolioHypercertRecord[]
  hypercertsDcu: number
  verifiedCleanups: number
  verifiedReports: number
  timeframeStart?: number
  timeframeEnd?: number
}

/** Preview row shown until `hypercerts[]` is wired from API; documents disclosure fields. */
const PLACEHOLDER_ROW: PortfolioHypercertRecord = {
  hypercertId: 'bafy…pending',
  metadataCid: 'bafy…pending',
  txHash: '0x…pending',
  status: 'PENDING',
  workTimeframeStart: undefined,
  workTimeframeEnd: undefined,
}

function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (!value) return '-'
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

function formatDate(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '-'
  return new Date(ms).toLocaleDateString()
}

function HypercertTableRow({
  row,
  placeholder = false,
}: {
  row: PortfolioHypercertRecord
  placeholder?: boolean
}) {
  return (
    <tr
      className={
        placeholder
          ? 'border-b border-dashed border-border/50 text-muted-foreground/70'
          : 'border-b border-border/40 last:border-0'
      }
    >
      <td className="px-3 py-2 font-mono">
        {truncateMiddle(row.hypercertId, 10, 8)}
        {placeholder ? (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">placeholder</span>
        ) : null}
      </td>
      <td className="px-3 py-2 font-mono">{truncateMiddle(row.metadataCid, 10, 8)}</td>
      <td className="px-3 py-2 font-mono">
        {row.workTimeframeStart && row.workTimeframeEnd
          ? `${formatDate(row.workTimeframeStart)} – ${formatDate(row.workTimeframeEnd)}`
          : '-'}
      </td>
      <td className="px-3 py-2 font-mono">{row.txHash ? truncateMiddle(row.txHash, 8, 6) : '-'}</td>
      <td className="px-3 py-2">{row.status}</td>
    </tr>
  )
}

export function PortfolioHypercertsSection({
  hypercerts,
  hypercertsDcu,
  verifiedCleanups,
  verifiedReports,
  timeframeStart,
  timeframeEnd,
}: Props) {
  const hasMinted = hypercerts.length > 0

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-meta text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Hypercert-compatible
          </p>
          <h2 className="font-heading text-xl tracking-wider">Impact Hypercerts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bundled onchain impact records derived from verified cleanups
          </p>
        </div>
        <Link
          href="/hypercerts"
          className="inline-flex items-center gap-1 text-xs text-brand-green underline underline-offset-2 hover:text-foreground"
        >
          Hypercerts hub
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Hypercert DCU', value: hypercertsDcu },
          { label: 'Minted', value: hypercerts.length },
          { label: 'Eligible cleanups', value: verifiedCleanups },
          { label: 'Impact reports', value: verifiedReports },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-heading text-xl leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      {timeframeStart && timeframeEnd ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Work timeframe: {formatDate(timeframeStart)} – {formatDate(timeframeEnd)}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="px-3 py-2 font-medium">Hypercert ID</th>
              <th className="px-3 py-2 font-medium">Metadata CID</th>
              <th className="px-3 py-2 font-medium">Work timeframe</th>
              <th className="px-3 py-2 font-medium">Mint tx</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {hasMinted ? (
              hypercerts.map((h) => <HypercertTableRow key={h.hypercertId} row={h} />)
            ) : (
              /* TODO: replace when hypercerts[] is populated from /api/hypercerts + mint index */
              <HypercertTableRow row={PLACEHOLDER_ROW} placeholder />
            )}
          </tbody>
        </table>
      </div>

      {!hasMinted ? (
        <div
          className="mt-3 flex items-start gap-3 rounded-md border border-dashed border-border/80 bg-background/30 p-3"
          aria-label="Hypercerts data pending"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-green/30 bg-brand-green/10">
            <Layers className="h-4 w-4 text-brand-green" aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No hypercerts minted for this portfolio yet. When live, rows above will show real hypercert ID, IPFS metadata CID, work timeframe, and mint transaction, wired from{' '}
            <code className="font-mono text-[10px] text-foreground/80">data.hypercerts</code> in{' '}
            <code className="font-mono text-[10px] text-foreground/80">public-portfolio-data.ts</code>.
          </p>
        </div>
      ) : null}
    </section>
  )
}
