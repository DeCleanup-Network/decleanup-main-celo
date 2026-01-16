/**
 * GPU-Based ML Verification Integration
 * Orchestrates photo storage, GPU inference, and verification scoring
 */

import { createHash } from 'crypto'

export interface GPUInferenceRequest {
  submissionId: string
  imageUrl: string
  phase: 'before' | 'after'
}

export interface DetectedObject {
  class: string
  confidence: number
  bbox: [number, number, number, number] // [x, y, width, height]
}

export interface GPUInferenceResponse {
  submissionId: string
  phase: 'before' | 'after'
  objects: DetectedObject[]
  objectCount: number
  meanConfidence: number
  modelVersion: string
}

export interface VerificationScore {
  submissionId: string
  beforeCount: number
  afterCount: number
  delta: number
  score: number
  verdict: 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED'
  modelVersion: string
  timestamp: number
  confidenceVariance?: number // Optional: add for debugging/transparency
  isStable?: boolean // Optional: add for debugging/transparency
}

/**
 * Call GPU inference service
 */
export async function callGPUInference(
  submissionId: string,
  imageUrl: string,
  phase: 'before' | 'after'
): Promise<GPUInferenceResponse> {
  const gpuServiceUrl = process.env.GPU_INFERENCE_SERVICE_URL || 'http://localhost:8000'
  const sharedSecret = process.env.GPU_SHARED_SECRET || ''
  
  const request: GPUInferenceRequest = {
    submissionId,
    imageUrl,
    phase,
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  // Always include Authorization header if secret is configured
  // GPU service will skip validation if SHARED_SECRET is empty
  if (sharedSecret) {
    headers['Authorization'] = `Bearer ${sharedSecret}`
    console.log(`[GPU Verification] Using authorization for ${phase} image (secret length: ${sharedSecret.length})`)
  } else {
    console.warn(`[GPU Verification] ⚠️ GPU_SHARED_SECRET not set or empty. GPU service must not require auth, or this will fail.`)
    console.warn(`[GPU Verification] Check: process.env.GPU_SHARED_SECRET = ${process.env.GPU_SHARED_SECRET ? 'SET' : 'NOT SET'}`)
  }
  
  try {
    const response = await fetch(`${gpuServiceUrl}/infer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      
      // Provide helpful error message for 401 errors
      if (response.status === 401) {
        console.error(`[GPU Verification] Authorization failed (401). Check:`)
        console.error(`  1. GPU service has SHARED_SECRET set: ${gpuServiceUrl}`)
        console.error(`  2. Frontend has GPU_SHARED_SECRET set: ${sharedSecret ? 'SET' : 'NOT SET'}`)
        console.error(`  3. Secrets match between frontend and GPU service`)
        throw new Error(`GPU service requires authorization. Set GPU_SHARED_SECRET in .env.local to match GPU service's SHARED_SECRET. Error: ${errorText}`)
      }
      
      throw new Error(`GPU inference failed: ${response.status} ${errorText}`)
    }
    
    const result: GPUInferenceResponse = await response.json()
    return result
  } catch (error) {
    console.error(`[GPU Verification] Inference error for ${phase}:`, error)
    throw error
  }
}

/**
 * Compute verification score from before/after inference results
 */
export function computeVerificationScore(
  beforeResult: GPUInferenceResponse,
  afterResult: GPUInferenceResponse
): VerificationScore {
  const beforeCount = beforeResult.objectCount
  const afterCount = afterResult.objectCount
  const delta = beforeCount - afterCount
  
  // Normalize trash delta
  // Conservative: max reasonable delta is 50 items
  // This can be tuned based on real-world data
  const maxDelta = 50
  
  // Handle negative delta (more objects after = bad, but could be detection error)
  // If delta is negative, it's suspicious but not necessarily invalid
  // We'll penalize it but not reject outright
  let normalizedTrashDelta: number
  if (delta < 0) {
    // Negative delta: more objects detected after cleanup (suspicious)
    // Penalize but don't completely reject (could be detection error)
    normalizedTrashDelta = Math.max(delta / maxDelta, -0.3) // Cap penalty at -0.3
    normalizedTrashDelta = (normalizedTrashDelta + 0.3) / 1.3 // Normalize to 0-1 range
  } else {
    // Positive delta: objects removed (good)
    normalizedTrashDelta = Math.min(Math.max(delta / maxDelta, 0), 1.0) // Clamp 0-1
  }
  
  // Calculate mean confidence from both results
  const meanConfidence = (beforeResult.meanConfidence + afterResult.meanConfidence) / 2
  
  // Base score with equal weighting
  const score = (meanConfidence * 0.5) + (normalizedTrashDelta * 0.5)

  // Stability check for verdict logic
  const confidenceVariance = Math.abs(beforeResult.meanConfidence - afterResult.meanConfidence)
  const isStable = confidenceVariance < 0.15
  
  // Stability-aware verdict logic
  let verdict: 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED'

  // Base verdict from score only
  if (score >= 0.6) {
    verdict = 'AUTO_VERIFIED'
  } else if (score >= 0.3) {
    verdict = 'NEEDS_REVIEW'
  } else {
    verdict = 'REJECTED'
  }

  // Stability override (downgrade unstable auto-verified candidates)
  if (verdict === 'AUTO_VERIFIED' && !isStable && delta >= 0) {
    verdict = 'NEEDS_REVIEW'
  }

  // Protection: never reject positive delta cleanups due to variance/low score alone
  if (verdict === 'REJECTED' && delta > 0) {
    verdict = 'NEEDS_REVIEW'
  }
  
  return {
    submissionId: beforeResult.submissionId,
    beforeCount,
    afterCount,
    delta,
    score,
    verdict,
    modelVersion: beforeResult.modelVersion,
    timestamp: Date.now(),
    confidenceVariance,
    isStable,
  }
}

/**
 * Hash verification result for on-chain storage
 */
export function hashVerificationResult(result: VerificationScore): string {
  const resultJson = JSON.stringify(result, Object.keys(result).sort())
  return createHash('sha256').update(resultJson).digest('hex')
}

/**
 * Full verification pipeline
 * 1. Call GPU service for before image
 * 2. Call GPU service for after image
 * 3. Compute verification score
 * 4. Return result with hash
 */
export async function runFullVerification(
  submissionId: string,
  beforeImageUrl: string,
  afterImageUrl: string
): Promise<{
  score: VerificationScore
  hash: string
  beforeInference: GPUInferenceResponse
  afterInference: GPUInferenceResponse
}> {
  console.log(`[GPU Verification] Starting full verification for submission ${submissionId}...`)
  
  // Run inference on both images in parallel
  const [beforeResult, afterResult] = await Promise.all([
    callGPUInference(submissionId, beforeImageUrl, 'before'),
    callGPUInference(submissionId, afterImageUrl, 'after'),
  ])
  
  console.log(`[GPU Verification] Before: ${beforeResult.objectCount} objects (confidence: ${beforeResult.meanConfidence.toFixed(3)}), After: ${afterResult.objectCount} objects (confidence: ${afterResult.meanConfidence.toFixed(3)})`)
  
  // Log detected objects for debugging
  if (beforeResult.objects.length > 0) {
    console.log(`[GPU Verification] Before photo detected objects:`, beforeResult.objects.map(obj => `${obj.class} (${(obj.confidence * 100).toFixed(1)}%)`).join(', '))
  } else {
    console.warn(`[GPU Verification] ⚠️ No objects detected in before photo. This may indicate: 1) Image doesn't contain detectable waste, 2) Model needs retraining, or 3) Image quality/format issue.`)
  }
  
  if (afterResult.objects.length > 0) {
    console.log(`[GPU Verification] After photo detected objects:`, afterResult.objects.map(obj => `${obj.class} (${(obj.confidence * 100).toFixed(1)}%)`).join(', '))
  } else {
    console.warn(`[GPU Verification] ⚠️ No objects detected in after photo. This may indicate: 1) Cleanup was successful (no waste remaining), 2) Image quality issue, or 3) Model detection issue.`)
  }
  
  // Compute verification score
  const score = computeVerificationScore(beforeResult, afterResult)
  
  // Generate hash for on-chain storage
  const hash = hashVerificationResult(score)
  
  console.log(`[GPU Verification] Verification complete: ${score.verdict} (score: ${score.score.toFixed(3)}, delta: ${score.delta})`)
  
  // Warn if score is suspiciously low
  if (score.score < 0.1 && beforeResult.objectCount === 0 && afterResult.objectCount === 0) {
    console.warn(`[GPU Verification] ⚠️ Very low score (${score.score.toFixed(3)}) with 0 objects detected in both images. Possible issues: 1) Same image uploaded twice, 2) Images don't contain detectable waste, 3) Model detection failure.`)
  }
  
  return {
    score,
    hash,
    beforeInference: beforeResult,
    afterInference: afterResult,
  }
}
