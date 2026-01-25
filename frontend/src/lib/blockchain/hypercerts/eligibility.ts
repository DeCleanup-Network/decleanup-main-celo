import { HYPERCERTS_CONFIG } from './config'
import { isTestingMode } from './testing'
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
  
  const testing = isTestingMode(params.chainId)
  
  console.log('🔍 [Testing Mode]', {
    testing,
    willUse: testing ? 'TESTNET thresholds' : 'MAINNET thresholds'
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
    testingOverride: testing ? true : undefined,
    reason: eligible
      ? undefined
      : `Requires ${thresholds.minCleanups} cleanups and ${thresholds.minReports} impact report(s)`,
  }
}