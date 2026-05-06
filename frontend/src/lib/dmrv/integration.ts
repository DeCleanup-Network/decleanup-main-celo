/**
 * DMRV Integration Helpers
 * Utilities for integrating AI verification into submission flow
 */

import { verifyCleanup } from './verification'
import { VerificationRequest, VerificationResponse } from './types'
import { getDMRVConfig } from './config'
import { recordVerification } from './metrics'

/**
 * Call DMRV service to verify a cleanup submission
 * Returns null if DMRV is disabled or fails
 */
export async function callDMRVVerification(
  submissionId: string,
  beforeImageCid: string,
  afterImageCid: string,
  latitude: number,
  longitude: number,
  timestamp?: number
): Promise<VerificationResponse | null> {
  const config = getDMRVConfig()
  
  if (!config.enabled) {
    console.log('[DMRV Integration] DMRV service is disabled, skipping AI verification')
    return null
  }
  
  try {
    const request: VerificationRequest = {
      submissionId,
      beforeImageCid,
      afterImageCid,
      gps: {
        latitude,
        longitude,
      },
      timestamp: timestamp || Date.now(),
    }
    
    console.log(`[DMRV Integration] Calling DMRV verification for submission ${submissionId}...`)
    
    // Call the API endpoint (or direct function if in same process)
    const response = await fetch('/api/dmrv/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[DMRV Integration] Verification failed:', errorData)
      return null
    }
    
    const result: VerificationResponse = await response.json()
    
    console.log(`[DMRV Integration] Verification result: ${result.decision} (confidence: ${(result.confidence * 100).toFixed(1)}%)`)
    
    // Record metrics
    recordVerification(result)
    
    return result
  } catch (error) {
    console.error('[DMRV Integration] Error calling DMRV:', error)
    // Don't throw - allow submission to continue with manual verification
    return null
  }
}

/**
 * Check if auto-approval should be performed based on DMRV result
 */
export function shouldAutoApprove(result: VerificationResponse | null): boolean {
  if (!result) {
    return false
  }
  
  const config = getDMRVConfig()
  
  return (
    result.decision === 'AUTO_APPROVED' &&
    result.confidence >= config.autoApproveThreshold &&
    config.allowAutoApprove
  )
}

/**
 * Log verification metrics (for telemetry)
 */
export function logVerificationMetrics(result: VerificationResponse | null): void {
  if (!result) {
    return
  }
  
  // Log to console (can be replaced with analytics service)
  console.log('[DMRV Metrics]', {
    decision: result.decision,
    confidence: result.confidence,
    beforeWasteCount: result.analysis.before.wasteCount,
    afterWasteCount: result.analysis.after.wasteCount,
    modelHash: result.modelHash,
    timestamp: result.timestamp,
  })
}
