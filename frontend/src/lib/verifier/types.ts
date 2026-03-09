/**
 * Verifier Application Types
 */

export interface VerifierApplication {
  id: string
  address: string
  appliedAt: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy?: string
  reviewedAt?: number
  notes?: string
}

export interface VerifierEligibility {
  eligible: boolean
  reasons: string[]
  metrics: {
    level: number
    dcuBalance: number
    approvedCleanups: number
  }
}

export interface VerifierMetrics {
  level: number
  dcuBalance: number
  approvedCleanups: number
}
