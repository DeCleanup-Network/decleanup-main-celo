/**
 * Fire-and-forget: append impact-report contributor emails to the ops Google Sheet.
 */

export function notifyContributorSheet(params: {
  submissionId: string
  txHash?: string
  submitterWallet?: string
  impactIpfsCid?: string
  latitude?: number
  longitude?: number
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
    contributors: string[]
    scopeOfWork?: string
    environmentalChallenges?: string
    preventionIdeas?: string
    additionalNotes?: string
    rightsAssignment?: string
  }
}): void {
  if (typeof window === 'undefined') return

  const contributors = (params.impact.contributors || [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'))
  if (contributors.length === 0) return

  void fetch('/api/impact/contributors-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      impact: { ...params.impact, contributors },
    }),
    keepalive: true,
  }).catch((err) => {
    console.warn('[notifyContributorSheet] failed (non-fatal):', err)
  })
}
