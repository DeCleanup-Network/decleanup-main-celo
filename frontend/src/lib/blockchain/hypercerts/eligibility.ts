import { ROBINHOOD_TESTNET_CHAIN_ID } from '../chain-constants'
import { HYPERCERTS_CONFIG } from './config'
import { HypercertEligibilityResult } from './types'

export function checkHypercertEligibility(params: {
  cleanupsCount: number
  reportsCount: number
  /** How many Hypercerts this user has already published (tiers unlock in multiples of minCleanups). */
  publishedCount?: number
  chainId?: number
}): HypercertEligibilityResult {
  const publishedCount = Math.max(0, params.publishedCount ?? 0)

  // Celo (mainnet and Sepolia) always uses production: 10 cleanups + 1 impact report.
  // Only Robinhood Chain testnet is the 1-cleanup demo. Never inherit env REQUIRED_CHAIN_ID.
  const thresholds =
    params.chainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? { minCleanups: 1, minReports: 0 }
      : HYPERCERTS_CONFIG.thresholds.production

  const nextMilestoneCleanups = thresholds.minCleanups * (publishedCount + 1)
  const meetsCleanups = params.cleanupsCount >= nextMilestoneCleanups
  const meetsReports = params.reportsCount >= thresholds.minReports
  const eligible = meetsCleanups && meetsReports

  let reason: string | undefined
  if (!eligible) {
    if (!meetsReports) {
      reason = `Requires at least ${thresholds.minReports} impact report(s) (you have ${params.reportsCount}).`
    } else if (publishedCount > 0) {
      reason = `Hypercert #${publishedCount + 1} unlocks at ${nextMilestoneCleanups} verified cleanups (you have ${params.cleanupsCount}).`
    } else {
      reason = `Requires ${nextMilestoneCleanups} verified cleanups and ${thresholds.minReports} impact report(s).`
    }
  }

  return {
    eligible,
    cleanupsCount: params.cleanupsCount,
    reportsCount: params.reportsCount,
    publishedCount,
    nextMilestoneCleanups,
    reason,
  }
}
