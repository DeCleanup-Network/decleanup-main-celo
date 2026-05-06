/**
 * Verifier Applications Storage
 * 
 * A-Lite: In-memory storage
 * Future: Migrate to Supabase
 * 
 * Storage structure:
 * Key: "verifier_applications"
 * Value: VerifierApplication[]
 */

import type { VerifierApplication, VerifierApplicationAdminStatus } from './types'

// In-memory storage (resets on server restart)
let applicationsStore: VerifierApplication[] = []

/**
 * Get all applications
 */
export function getAllApplications(): VerifierApplication[] {
  return [...applicationsStore]
}

/**
 * Get application by ID
 */
export function getApplicationById(id: string): VerifierApplication | null {
  return applicationsStore.find(app => app.id === id) || null
}

/**
 * Get applications by address
 */
export function getApplicationsByAddress(address: string): VerifierApplication[] {
  return applicationsStore.filter(app => app.address.toLowerCase() === address.toLowerCase())
}

/**
 * Get latest application for address
 */
export function getLatestApplicationByAddress(address: string): VerifierApplication | null {
  const apps = getApplicationsByAddress(address)
  return apps.length > 0 ? apps[apps.length - 1] : null
}

/**
 * Create new application
 */
export function createApplication(address: string): VerifierApplication {
  const id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const application: VerifierApplication = {
    id,
    address: address.toLowerCase(),
    appliedAt: Date.now(),
    status: 'PENDING',
  }

  applicationsStore.push(application)
  return application
}

/**
 * Update application status
 */
export function updateApplicationStatus(
  id: string,
  status: VerifierApplicationAdminStatus,
  reviewedBy: string,
  notes?: string,
  _txHash?: string
): VerifierApplication | null {
  const app = getApplicationById(id)
  
  if (!app) {
    return null
  }

  app.status = status
  app.reviewedBy = reviewedBy.toLowerCase()
  app.reviewedAt = Date.now()
  if (notes) {
    app.notes = notes
  }

  return app
}

/**
 * Check if address has pending application
 */
export function hasPendingApplication(address: string): boolean {
  return applicationsStore.some(
    app => app.address.toLowerCase() === address.toLowerCase() && app.status === 'PENDING'
  )
}

/**
 * Check if address has approved application
 */
export function hasApprovedApplication(address: string): boolean {
  return applicationsStore.some(
    app => app.address.toLowerCase() === address.toLowerCase() && app.status === 'APPROVED'
  )
}

/**
 * Get stats
 */
export function getApplicationStats() {
  return {
    total: applicationsStore.length,
    pending: applicationsStore.filter(app => app.status === 'PENDING').length,
    approvalPendingOnchain: applicationsStore.filter(app => app.status === 'PENDING_ONCHAIN')
      .length,
    approved: applicationsStore.filter(app => app.status === 'APPROVED').length,
    rejected: applicationsStore.filter(app => app.status === 'REJECTED').length,
  }
}
