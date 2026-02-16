/**
 * Verifier Configuration
 * 
 * Centralized rules for verifier eligibility
 * Easy to modify without touching logic
 */

export const VERIFIER_CONFIG = {
  // Eligibility requirements
  requirements: {
    minLevel: 3,
    minDCUBalance: 30,
    minApprovedCleanups: 5,
  },

  // Application rules
  application: {
    allowReapplyAfterRejection: true,
    reapplyWaitDays: 30,
  },

  // UI settings
  ui: {
    showEligibilityReasons: true,
    showMetrics: true,
  },
}

/**
 * Get readable message for eligibility failure
 */
export function getEligibilityMessage(metric: string, value: number, required: number): string {
  const gap = required - value
  
  const messages: Record<string, (gap: number) => string> = {
    level: (gap) => `Reach level ${required} (currently ${value}, need ${gap} more)`,
    dcuBalance: (gap) => `Have ${required} cDCU balance (currently ${value}, need ${gap} more)`,
    approvedCleanups: (gap) => `Complete ${required} approved cleanups (currently ${value}, need ${gap} more)`,
  }
  
  return messages[metric]?.(gap) || `${metric}: ${value}/${required}`
}
