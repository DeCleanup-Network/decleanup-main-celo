/**
 * Verifier Application Types
 */

/** Matches DB `verifier_applications.status` (varchar(20) max — keep values ≤20 chars). */
export type VerifierApplicationStatus =
  | 'PENDING'
  | 'PENDING_ONCHAIN'
  | 'APPROVED'
  | 'REJECTED'

/** Admin-driven status updates (initial `PENDING` is set on create only). */
export type VerifierApplicationAdminStatus = Extract<
  VerifierApplicationStatus,
  'PENDING_ONCHAIN' | 'APPROVED' | 'REJECTED'
>

export interface VerifierApplication {
  id: string
  address: string
  appliedAt: number
  status: VerifierApplicationStatus
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
