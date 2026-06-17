import type { PublicPortfolioPayload } from '@/lib/impact/public-portfolio-shared'
import type { EditableProfile } from '@/lib/impact/portfolio-profile'
import type { PortfolioEndorsement } from '@/lib/impact/portfolio-endorsements'
import { PLASTIC_CO2E_FACTOR_KG, estimatePlasticCo2eKg } from '@/lib/impact/portfolio-display'

export type PortfolioDisclosureExport = {
  schema: 'decleanup-impact-portfolio/v1'
  exportedAt: string
  portfolioUrl: string
  identity: {
    ensName: string | null
    walletAddress: string
    legalName: string
    ensTextRecords: Record<string, string>
  }
  profile: EditableProfile
  metrics: {
    dcuRecognized: number
    verifiedCleanups: number
    impactReports: number
    cumulativeWeightKg: number
    cumulativeAreaSqm: number
    co2eEstimateKg: number
    co2eMethodology: string
  }
  framework: {
    sdgs: number[]
    locationLabel: string
    coordinates: string | null
  }
  onchain: PublicPortfolioPayload
  endorsements?: PortfolioEndorsement[]
}

export function buildPortfolioDisclosureExport(params: {
  data: PublicPortfolioPayload
  profile: EditableProfile | null
  ensName: string | null
  portfolioUrl: string
  ensTextRecords?: Record<string, string>
}): PortfolioDisclosureExport {
  const profile = params.profile
  const weightKg = params.data.cumulative.weightKg
  return {
    schema: 'decleanup-impact-portfolio/v1',
    exportedAt: new Date().toISOString(),
    portfolioUrl: params.portfolioUrl,
    identity: {
      ensName: params.ensName,
      walletAddress: params.data.address,
      legalName: profile?.legalName?.trim() || profile?.creatorName?.trim() || '',
      ensTextRecords: params.ensTextRecords ?? {},
    },
    profile: profile ?? {
      displayName: '',
      bio: '',
      locationLabel: '',
      locationCoords: '',
      showPreciseLocation: false,
      legalName: '',
      impactContext: '',
      additionalityStatement: '',
      creatorName: '',
      creatorRole: '',
      projects: '',
      openTo: '',
      farcaster: '',
      twitter: '',
      dapp: '',
    },
    metrics: {
      dcuRecognized: params.data.rewards.totalDcuBreakdown,
      verifiedCleanups: params.data.verifiedCleanups,
      impactReports: params.data.verifiedWithReport,
      cumulativeWeightKg: weightKg,
      cumulativeAreaSqm: params.data.cumulative.areaSqm,
      co2eEstimateKg: estimatePlasticCo2eKg(weightKg),
      co2eMethodology: `Plastic weight x IPCC AR6 displacement factor (${PLASTIC_CO2E_FACTOR_KG} kg CO2e per kg)`,
    },
    framework: {
      sdgs: [11, 14, 15],
      locationLabel: profile?.locationLabel?.trim() || '',
      coordinates: profile?.showPreciseLocation ? profile.locationCoords?.trim() || null : null,
    },
    onchain: params.data,
  }
}

export function downloadJsonDisclosure(payload: PortfolioDisclosureExport, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function triggerPortfolioPrint() {
  if (typeof window === 'undefined') return
  window.print()
}

export function buildReportPrintHtml(params: {
  title: string
  scope: string
  wasteType: string
  challenges: string
  prevention: string
  weightKg: string
  areaSqm: string
  cid: string
  portfolioUrl: string
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(params.title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.35rem} .meta{font-size:0.8rem;color:#555} table{width:100%;border-collapse:collapse;margin:1rem 0}
td,th{border:1px solid #ccc;padding:0.5rem;text-align:left;font-size:0.85rem} th{background:#f4f4f4}
.footer{margin-top:2rem;font-size:0.75rem;color:#666}
</style></head><body>
<h1>DeCleanup Impact Report Summary</h1>
<p class="meta">GRI-inspired one-page summary · hash-anchored evidence on IPFS</p>
<table>
<tr><th>Campaign / cleanup</th><td>${esc(params.title)}</td></tr>
<tr><th>Scope</th><td>${esc(params.scope)}</td></tr>
<tr><th>Waste type</th><td>${esc(params.wasteType)}</td></tr>
<tr><th>Challenges</th><td>${esc(params.challenges)}</td></tr>
<tr><th>Prevention note</th><td>${esc(params.prevention)}</td></tr>
<tr><th>Weight</th><td>${esc(params.weightKg)}</td></tr>
<tr><th>Area</th><td>${esc(params.areaSqm)}</td></tr>
<tr><th>IPFS CID</th><td style="font-family:monospace;font-size:0.75rem">${esc(params.cid)}</td></tr>
</table>
<p class="footer">Portfolio: ${esc(params.portfolioUrl)} · Generated ${esc(new Date().toISOString())}</p>
<script>window.onload=function(){window.print()}</script></body></html>`
}

export function openReportPrintWindow(html: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  w.document.write(html)
  w.document.close()
}
