/**
 * Supabase Database Types
 * Auto-generated from schema (or manually defined)
 */

export type VerifierApplication = {
  id: string
  address: string
  applied_at: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewed_by?: string
  reviewed_at?: number
  notes?: string
  tx_hash?: string
  processing: boolean
  created_at: string
  updated_at: string
}

export type VerifierAuditLog = {
  id: string
  application_id: string
  action: string
  actor_address: string
  details?: Record<string, any>
  timestamp: string
}

export type ImpactSnapshot = {
  id: string
  snapshot_date: string
  generated_at: string
  total_cleanups: number
  total_contributors: number
  total_area_sqm: number
  total_weight_kg: number
  total_bags: number
  total_time_minutes: number
  top_locations: Record<string, any>
  waste_breakdown: Record<string, any>
  sdg_impact: Record<string, any>
  raw_data: Record<string, any>
  created_at: string
}