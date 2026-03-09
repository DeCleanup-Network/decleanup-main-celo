/**
 * Verifier Eligibility Engine
 * 
 * Pure logic: Check if address meets verifier requirements
 * No side effects, fully testable
 */

import { VERIFIER_CONFIG, getEligibilityMessage } from '@/config/verifier'
import { VerifierEligibility, VerifierMetrics } from './types'

/**
 * Check if address is eligible to apply for verifier role
 * 
 * @param metrics User metrics (level, dcu balance, cleanups)
 * @returns Eligibility result with reasons
 */
export function checkEligibility(metrics: VerifierMetrics): VerifierEligibility {
  const reasons: string[] = []
  const { minLevel, minDCUBalance, minApprovedCleanups } = VERIFIER_CONFIG.requirements

  // Check level
  if (metrics.level < minLevel) {
    reasons.push(getEligibilityMessage('level', metrics.level, minLevel))
  }

  // Check DCU balance
  if (metrics.dcuBalance < minDCUBalance) {
    reasons.push(getEligibilityMessage('dcuBalance', metrics.dcuBalance, minDCUBalance))
  }

  // Check approved cleanups
  if (metrics.approvedCleanups < minApprovedCleanups) {
    reasons.push(getEligibilityMessage('approvedCleanups', metrics.approvedCleanups, minApprovedCleanups))
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    metrics,
  }
}

/**
 * Format eligibility result for display
 */
export function formatEligibilityStatus(eligibility: VerifierEligibility): string {
  if (eligibility.eligible) {
    return '✅ You are eligible to apply!'
  }

  return `❌ Not eligible. ${eligibility.reasons.join(' | ')}`
}
