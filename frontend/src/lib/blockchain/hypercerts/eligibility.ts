import { HYPERCERTS_CONFIG } from './config'
import { isTestingMode, useRelaxedHypercertThresholds } from './testing'
import { HypercertEligibilityResult } from './types'

export function checkHypercertEligibility(params: {
  cleanupsCount: number
  reportsCount: number
  chainId?: number
}): HypercertEligibilityResult {
  console.log('🔍 [Eligibility Debug]', {
    chainId: params.chainId,
    chainIdType: typeof params.chainId,
    cleanupsCount: params.cleanupsCount,
    reportsCount: params.reportsCount
  })
  
  const relaxed = useRelaxedHypercertThresholds() && isTestingMode(params.chainId)
  /** Production-style gates unless NEXT_PUBLIC_HYPERCERT_RELAXED_ELIGIBILITY=true */
  const testing = relaxed

  console.log('🔍 [Testing Mode]', {
    relaxedHypercertThresholds: relaxed,
    willUse: testing ? 'TESTNET (relaxed) thresholds' : 'PRODUCTION thresholds',
  })

  const thresholds = testing
    ? HYPERCERTS_CONFIG.thresholds.testing
    : HYPERCERTS_CONFIG.thresholds.production
  
  console.log('🔍 [Thresholds]', thresholds)

  const eligible =
    params.cleanupsCount >= thresholds.minCleanups &&
    params.reportsCount >= thresholds.minReports

  return {
    eligible,
    cleanupsCount: params.cleanupsCount,
    reportsCount: params.reportsCount,
    testingOverride: relaxed ? true : undefined,
    reason: eligible
      ? undefined
      : `Requires ${thresholds.minCleanups} cleanups and ${thresholds.minReports} impact report(s)`,
  }
}