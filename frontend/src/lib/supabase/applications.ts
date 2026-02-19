import { getSupabase } from './client'
/**
 * Verifier Applications Repository (Supabase)
 * Production-grade with full type safety
 */

import { supabase } from './client'
import { VerifierApplication } from '../verifier/types'
import type { Database } from './database.types'

type Tables = Database['public']['Tables']
type VerifierAppRow = Tables['verifier_applications']['Row']
type VerifierAppInsert = Tables['verifier_applications']['Insert']
type VerifierAppUpdate = Tables['verifier_applications']['Update']

/**
 * Create new application in database
 */
export async function createApplication(address: string): Promise<VerifierApplication> {
  const insertData: VerifierAppInsert = {
    address: address.toLowerCase(),
    applied_at: Date.now(),
    status: 'PENDING',
    processing: false,
  }

  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .insert([insertData])
    .select()
    .single()

  if (error) throw new Error(`Failed to create application: ${error.message}`)
  return mapRowToApplication(data as VerifierAppRow)
}

/**
 * Get application by ID
 */
export async function getApplicationById(id: string): Promise<VerifierApplication | null> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  return mapRowToApplication(data as VerifierAppRow)
}

/**
 * Get latest application by address
 */
export async function getLatestApplicationByAddress(address: string): Promise<VerifierApplication | null> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select()
    .eq('address', address.toLowerCase())
    .order('applied_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  return mapRowToApplication(data as VerifierAppRow)
}

/**
 * Get all applications (admin)
 */
export async function getAllApplications(): Promise<VerifierApplication[]> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select()
    .order('applied_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch applications: ${error.message}`)
  return (data as VerifierAppRow[] | null)?.map(mapRowToApplication) || []
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewedBy: string,
  notes?: string
): Promise<VerifierApplication | null> {
  const updateData: VerifierAppUpdate = {
    status,
    reviewed_by: reviewedBy.toLowerCase(),
    reviewed_at: Date.now(),
    notes,
    processing: false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update application: ${error.message}`)
  return mapRowToApplication(data as VerifierAppRow)
}

/**
 * Lock application for processing
 */
export async function lockApplication(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .update({ processing: true } as VerifierAppUpdate)
    .eq('id', id)
    .eq('processing', false)
    .select()

  if (error) {
    console.error('Failed to lock application:', error)
    return false
  }

  return ((data as VerifierAppRow[] | null)?.length ?? 0) > 0
}

/**
 * Unlock application
 */
export async function unlockApplication(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('verifier_applications')
    .update({ processing: false } as VerifierAppUpdate)
    .eq('id', id)

  if (error) {
    console.error('Failed to unlock application:', error)
  }
}

/**
 * Check if has pending application
 */
export async function hasPendingApplication(address: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select('id')
    .eq('address', address.toLowerCase())
    .eq('status', 'PENDING')
    .limit(1)

  if (error) {
    console.error('Error checking pending application:', error)
    return false
  }

  return ((data as VerifierAppRow[] | null)?.length ?? 0) > 0
}

/**
 * Check if has approved application
 */
export async function hasApprovedApplication(address: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select('id')
    .eq('address', address.toLowerCase())
    .eq('status', 'APPROVED')
    .limit(1)

  if (error) {
    console.error('Error checking approved application:', error)
    return false
  }

  return ((data as VerifierAppRow[] | null)?.length ?? 0) > 0
}

/**
 * Get application stats
 */
export async function getApplicationStats(): Promise<{
  total: number
  pending: number
  approved: number
  rejected: number
}> {
  const { data, error } = await getSupabase()
    .from('verifier_applications')
    .select('status')

  if (error) {
    console.error('Error getting stats:', error)
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }

  const rows = (data as VerifierAppRow[] | null) || []

  return {
    total: rows.length,
    pending: rows.filter(r => r.status === 'PENDING').length,
    approved: rows.filter(r => r.status === 'APPROVED').length,
    rejected: rows.filter(r => r.status === 'REJECTED').length,
  }
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  applicationId: string,
  action: string,
  actor: string,
  details?: Record<string, any>
): Promise<void> {
  type AuditInsert = Tables['verifier_audit_log']['Insert']
  
  const insertData: AuditInsert = {
    application_id: applicationId,
    action,
    actor_address: actor.toLowerCase(),
    details: (details || {}) as any,
  }

  const { error } = await getSupabase()
    .from('verifier_audit_log')
    .insert([insertData])

  if (error) {
    console.error('Failed to log audit:', error)
  }
}

/**
 * Map database row to VerifierApplication type
 */
function mapRowToApplication(row: VerifierAppRow): VerifierApplication {
  return {
    id: row.id,
    address: row.address,
    appliedAt: row.applied_at,
    status: row.status,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    notes: row.notes || undefined,
  }
}
