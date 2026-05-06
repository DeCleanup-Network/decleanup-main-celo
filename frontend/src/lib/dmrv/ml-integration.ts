/**
 * ML Verification Integration (VPS Backend)
 * Orchestrates the full ML verification pipeline:
 * 1. Store photos on VPS
 * 2. Call GPU inference service
 * 3. Compute verification score
 * 4. Store hash on-chain
 */

import { VerificationScore } from './gpu-verification'
import { storeVerificationHashOnChain } from './onchain-hash'

export interface MLVerificationResult {
  submissionId: string
  score: VerificationScore
  hash: string
  beforeInference: any
  afterInference: any
  imageUrls: {
    before: string
    after: string
  }
}

/**
 * Run full ML verification pipeline
 * Called after submission is created
 */
export async function runMLVerification(
  submissionId: string,
  beforeImageCid: string,
  afterImageCid: string
): Promise<MLVerificationResult | null> {
  try {
    console.log(`[ML Integration] Starting ML verification for submission ${submissionId}...`)
    
    // Call VPS backend ML verification API
    const response = await fetch('/api/ml-verification/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId,
        beforeImageCid,
        afterImageCid,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[ML Integration] Verification failed:', errorData)
      return null
    }
    
    const result: MLVerificationResult = await response.json()
    
    console.log(`[ML Integration] Verification complete: ${result.score.verdict} (score: ${result.score.score.toFixed(3)})`)
    
    // Store hash on-chain (if verifier role available)
    // Note: This requires VERIFIER_ROLE, so it may fail silently
    try {
      const submissionIdBigInt = BigInt(submissionId)
      await storeVerificationHashOnChain(submissionIdBigInt, result.hash)
      console.log(`[ML Integration] Verification hash stored on-chain: ${result.hash}`)
    } catch (onchainError) {
      console.warn('[ML Integration] Failed to store hash on-chain (may not have VERIFIER_ROLE):', onchainError)
      // Don't fail - hash can be stored later by verifier
    }
    
    return result
  } catch (error) {
    console.error('[ML Integration] Error:', error)
    return null
  }
}

/**
 * Check if ML verification should be used
 */
export function isMLVerificationEnabled(): boolean {
  return process.env.ML_VERIFICATION_ENABLED === 'true'
}
