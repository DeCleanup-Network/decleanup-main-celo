import { HYPERCERTS_CONFIG } from './config'
import { isTestingMode } from './testing'
import { HypercertEligibilityResult } from './types'

export function checkHypercertEligibility(params: {
  cleanupsCount: number
  reportsCount: number
}): HypercertEligibilityResult {
  const testing = isTestingMode()

  const thresholds = testing
    ? HYPERCERTS_CONFIG.thresholds.testing
    : HYPERCERTS_CONFIG.thresholds.production

  const eligible =
    params.cleanupsCount >= thresholds.minCleanups &&
    params.reportsCount >= thresholds.minReports

  return {
    eligible,
    cleanupsCount: params.cleanupsCount,
    reportsCount: params.reportsCount,
    testingOverride: testing || undefined,
    reason: eligible
      ? undefined
      : `Requires ${thresholds.minCleanups} cleanups and ${thresholds.minReports} impact report(s)`,
  }
}