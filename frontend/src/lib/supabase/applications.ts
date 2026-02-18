/**
 * Verifier Applications Repository (Supabase)
 * Replaces in-memory storage with persistent database
 */

import { supabase } from './client'
import { VerifierApplication } from './types'
import { Address } from 'viem'

/**
 * Create new application in database
 */
export async function createApplication(address: string): Promise<VerifierApplication> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .insert({
      address: address.toLowerCase(),
      applied_at: Date.now(),
      status: 'PENDING',
      processing: false,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create application: ${error.message}`)

  return data
}

/**
 * Get application by ID
 */
export async function getApplicationById(id: string): Promise<VerifierApplication | null> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Get latest application by address
 */
export async function getLatestApplicationByAddress(address: string): Promise<VerifierApplication | null> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .eq('address', address.toLowerCase())
    .order('applied_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/**
 * Get all applications (admin)
 */
export async function getAllApplications(): Promise<VerifierApplication[]> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .order('applied_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch applications: ${error.message}`)
  return data || []
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
  const { data, error } = await supabase
    .from('verifier_applications')
    .update({
      status,
      reviewed_by: reviewedBy.toLowerCase(),
      reviewed_at: Date.now(),
      notes,
      processing: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update application: ${error.message}`)
  return data
}

/**
 * Lock application for processing
 * Returns true if lock succeeded, false if already locked
 */
export async function lockApplication(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .update({ processing: true })
    .eq('id', id)
    .eq('processing', false)
    .select()

  if (error) {
    console.error('Failed to lock application:', error)
    return false
  }

  return data && data.length > 0
}

/**
 * Unlock application
 */
export async function unlockApplication(id: string): Promise<void> {
  const { error } = await supabase
    .from('verifier_applications')
    .update({ processing: false })
    .eq('id', id)

  if (error) {
    console.error('Failed to unlock application:', error)
  }
}

/**
 * Check if has pending application
 */
export async function hasPendingApplication(address: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select('id')
    .eq('address', address.toLowerCase())
    .eq('status', 'PENDING')
    .limit(1)

  if (error) {
    console.error('Error checking pending application:', error)
    return false
  }

  return data && data.length > 0
}

/**
 * Check if has approved application
 */
export async function hasApprovedApplication(address: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select('id')
    .eq('address', address.toLowerCase())
    .eq('status', 'APPROVED')
    .limit(1)

  if (error) {
    console.error('Error checking approved application:', error)
    return false
  }

  return data && data.length > 0
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
  const { data, error } = await supabase
    .from('verifier_applications')
    .select('status')

  if (error) {
    console.error('Error getting stats:', error)
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }

  const stats = {
    total: data?.length || 0,
    pending: data?.filter(d => d.status === 'PENDING').length || 0,
    approved: data?.filter(d => d.status === 'APPROVED').length || 0,
    rejected: data?.filter(d => d.status === 'REJECTED').length || 0,
  }

  return stats
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
  const { error } = await supabase
    .from('verifier_audit_log')
    .insert({
      application_id: applicationId,
      action,
      actor_address: actor.toLowerCase(),
      details: details || {},
    })

  if (error) {
    console.error('Failed to log audit:', error)
  }
}
