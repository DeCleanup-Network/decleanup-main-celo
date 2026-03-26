import { CleanupReference } from './types'

/** Chain stores Unix seconds; JS Date and hypercert display expect ms. */
function verifiedAtToMs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return t
  return t < 1e12 ? t * 1000 : t
}

export function aggregateUserCleanups(
  cleanups: CleanupReference[]
) {
  if (cleanups.length === 0) {
    throw new Error('No cleanups to aggregate')
  }

  const timestamps = cleanups.map((c) => verifiedAtToMs(c.verifiedAt))

  return {
    totalCleanups: cleanups.length,
    timeframeStart: Math.min(...timestamps),
    timeframeEnd: Math.max(...timestamps),
  }
}
/**
 * Build verifier context from aggregated requests
 * Shows impact summary for verifier decision-making
 */
export function buildVerifierContext(requests: any[]) {
  if (requests.length === 0) {
    return {
      totalRequests: 0,
      totalCleanups: 0,
      totalReports: 0,
      status: {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      },
      dateRange: null,
    }
  }

  let totalCleanups = 0
  let totalReports = 0
  const statusCount = { PENDING: 0, APPROVED: 0, REJECTED: 0 }
  const dates: number[] = []

  requests.forEach(req => {
    statusCount[req.status as keyof typeof statusCount]++
    
    if (req.metadata?.properties) {
      const cleanupsAttr = req.metadata.properties.find(
        (p: any) => p.trait_type === 'Total Cleanups'
      )
      const reportsAttr = req.metadata.properties.find(
        (p: any) => p.trait_type === 'Impact Reports'
      )
      
      if (cleanupsAttr) totalCleanups += Number(cleanupsAttr.value) || 0
      if (reportsAttr) totalReports += Number(reportsAttr.value) || 0
    }

    if (req.submittedAt) dates.push(req.submittedAt)
    if (req.reviewedAt) dates.push(req.reviewedAt)
  })

  return {
    totalRequests: requests.length,
    totalCleanups,
    totalReports,
    status: statusCount,
    dateRange: dates.length > 0 ? {
      start: Math.min(...dates),
      end: Math.max(...dates),
    } : null,
  }
}
