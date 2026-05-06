/**
 * Verifier Configuration
 * 
 * Centralized rules for verifier eligibility
 * Easy to modify without touching logic
 */

export const VERIFIER_CONFIG = {
  // Eligibility requirements
  requirements: {
    minLevel: 5,
    minDCUBalance: 50,
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
    level: (gap) => `Reach Impact Product level ${required}; ${gap} more needed`,
    dcuBalance: (gap) => `Earn at least ${required} DCU points; ${gap} more needed`,
    approvedCleanups: (gap) => `Complete ${required} approved cleanups; ${gap} more needed`,
  }
  
  return messages[metric]?.(gap) || `${metric}: ${value}/${required}`
}
