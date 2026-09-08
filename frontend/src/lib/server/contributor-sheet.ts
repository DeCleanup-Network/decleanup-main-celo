import 'server-only'

/**
 * Append impact-report contributor rows to a Google Sheet via Apps Script webhook.
 *
 * Env: CONTRIBUTOR_SHEET_WEBHOOK_URL (deployed Apps Script Web App URL)
 * See docs/CONTRIBUTOR_SHEET.md
 */

export type ContributorSheetRow = {
  recordedAt: string
  submissionId: string
  txHash: string
  contributorEmail: string
  submitterWallet: string
  cleanupDate: string
  campaignName: string
  locationType: string
  latitude: string
  longitude: string
  mapsUrl: string
  area: string
  areaUnit: string
  weight: string
  weightUnit: string
  bags: string
  hours: string
  minutes: string
  durationLabel: string
  wasteTypes: string
  howScopeOfWork: string
  environmentalChallenges: string
  preventionIdeas: string
  additionalNotes: string
  rightsAssignment: string
  impactIpfsCid: string
  impactIpfsUrl: string
  verifierUrl: string
}

export function isContributorSheetConfigured(): boolean {
  return Boolean(process.env.CONTRIBUTOR_SHEET_WEBHOOK_URL?.trim())
}

function gatewayBase(): string {
  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  return gateway.endsWith('/') ? gateway : `${gateway}/`
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_URL_BASE ||
    'https://dapp.decleanup.net'
  ).replace(/\/$/, '')
}

export function buildContributorSheetRows(params: {
  submissionId: string
  txHash?: string
  submitterWallet?: string
  impactIpfsCid?: string
  latitude?: number | null
  longitude?: number | null
  impact: {
    cleanupDate?: string
    campaignName?: string
    locationType?: string
    area?: string
    areaUnit?: string
    weight?: string
    weightUnit?: string
    bags?: string
    hours?: string
    minutes?: string
    wasteTypes?: string[]
    contributors?: string[]
    scopeOfWork?: string
    environmentalChallenges?: string
    preventionIdeas?: string
    additionalNotes?: string
    rightsAssignment?: string
  }
}): ContributorSheetRow[] {
  const emails = [...new Set(
    (params.impact.contributors || [])
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => e.includes('@'))
  )]
  if (emails.length === 0) return []

  const lat = params.latitude
  const lng = params.longitude
  const mapsUrl =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : ''

  const hours = String(params.impact.hours ?? '').trim() || '0'
  const minutes = String(params.impact.minutes ?? '').trim() || '0'
  const cid = (params.impactIpfsCid || '').replace(/^ipfs:\/\//, '').trim()
  const recordedAt = new Date().toISOString()
  const base = appBaseUrl()

  return emails.map((contributorEmail) => ({
    recordedAt,
    submissionId: params.submissionId,
    txHash: params.txHash || '',
    contributorEmail,
    submitterWallet: params.submitterWallet || '',
    cleanupDate: String(params.impact.cleanupDate || ''),
    campaignName: String(params.impact.campaignName || ''),
    locationType: String(params.impact.locationType || ''),
    latitude: typeof lat === 'number' && Number.isFinite(lat) ? String(lat) : '',
    longitude: typeof lng === 'number' && Number.isFinite(lng) ? String(lng) : '',
    mapsUrl,
    area: String(params.impact.area || ''),
    areaUnit: String(params.impact.areaUnit || ''),
    weight: String(params.impact.weight || ''),
    weightUnit: String(params.impact.weightUnit || ''),
    bags: String(params.impact.bags || ''),
    hours,
    minutes,
    durationLabel: `${hours}h ${minutes}m`,
    wasteTypes: Array.isArray(params.impact.wasteTypes)
      ? params.impact.wasteTypes.join(', ')
      : '',
    howScopeOfWork: String(params.impact.scopeOfWork || ''),
    environmentalChallenges: String(params.impact.environmentalChallenges || ''),
    preventionIdeas: String(params.impact.preventionIdeas || ''),
    additionalNotes: String(params.impact.additionalNotes || ''),
    rightsAssignment: String(params.impact.rightsAssignment || ''),
    impactIpfsCid: cid,
    impactIpfsUrl: cid ? `${gatewayBase()}${cid}` : '',
    verifierUrl: `${base}/verifier`,
  }))
}

export type AppendContributorSheetResult =
  | { ok: true; rows: number }
  | { ok: false; reason: 'not_configured' | 'no_rows' | 'webhook_error'; detail?: string }

/** POST rows to Apps Script web app. One HTTP call with all rows. */
export async function appendContributorSheetRows(
  rows: ContributorSheetRow[]
): Promise<AppendContributorSheetResult> {
  const url = process.env.CONTRIBUTOR_SHEET_WEBHOOK_URL?.trim()
  if (!url) return { ok: false, reason: 'not_configured' }
  if (rows.length === 0) return { ok: false, reason: 'no_rows' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'decleanup-rewards',
        type: 'impact_contributors',
        rows,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return {
        ok: false,
        reason: 'webhook_error',
        detail: text.slice(0, 300) || `HTTP ${res.status}`,
      }
    }
    return { ok: true, rows: rows.length }
  } catch (e) {
    return {
      ok: false,
      reason: 'webhook_error',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
