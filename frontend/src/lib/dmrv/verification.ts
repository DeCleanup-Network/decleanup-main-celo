/**
 * DMRV Verification Logic
 * Analyzes before/after images and makes verification decision
 */

import {
  VerificationRequest,
  VerificationResponse,
  VerificationDecision,
  ImageAnalysis,
} from './types'
import { getDMRVConfig } from './config'
import { fetchImageFromIPFS, validateImage } from './ipfs'
import { detectWaste } from './detection'
import { createHash } from 'crypto'

/**
 * Generate hash for model version/weights
 * In production, this would hash the actual model file
 */
function getModelHash(): string {
  const config = getDMRVConfig()
  const modelInfo = `${config.modelProvider}-${config.modelName || 'default'}-v1`
  return createHash('sha256').update(modelInfo).digest('hex').slice(0, 16)
}

/**
 * Generate hash for verification result (for audit trail)
 */
function getResultHash(
  beforeAnalysis: ImageAnalysis,
  afterAnalysis: ImageAnalysis,
  decision: VerificationDecision,
  confidence: number
): string {
  const resultData = JSON.stringify({
    before: {
      hasWaste: beforeAnalysis.hasWaste,
      wasteCount: beforeAnalysis.wasteCount,
      confidence: beforeAnalysis.overallConfidence,
    },
    after: {
      hasWaste: afterAnalysis.hasWaste,
      wasteCount: afterAnalysis.wasteCount,
      confidence: afterAnalysis.overallConfidence,
    },
    decision,
    confidence,
  })
  
  return createHash('sha256').update(resultData).digest('hex').slice(0, 16)
}

/**
 * Generate reasoning text for verification decision
 */
function generateReasoning(
  beforeAnalysis: ImageAnalysis,
  afterAnalysis: ImageAnalysis,
  decision: VerificationDecision
): string {
  if (decision === 'AUTO_APPROVED') {
    return `Cleanup verified: Before image shows ${beforeAnalysis.wasteCount} waste items (confidence: ${(beforeAnalysis.overallConfidence * 100).toFixed(1)}%), after image shows clean state (confidence: ${(afterAnalysis.overallConfidence * 100).toFixed(1)}%). High confidence match.`
  } else {
    return `Requires manual review: Before image analysis (${beforeAnalysis.wasteCount} items, ${(beforeAnalysis.overallConfidence * 100).toFixed(1)}% confidence) or after image analysis (${afterAnalysis.wasteCount} items, ${(afterAnalysis.overallConfidence * 100).toFixed(1)}% confidence) below auto-approval threshold.`
  }
}

/**
 * Make verification decision based on analysis
 */
function makeDecision(
  beforeAnalysis: ImageAnalysis,
  afterAnalysis: ImageAnalysis
): { decision: VerificationDecision; confidence: number } {
  const config = getDMRVConfig()
  
  // Core logic:
  // 1. BEFORE image should have waste detected
  // 2. AFTER image should have no/minimal waste
  // 3. Both analyses should have high confidence
  
  const beforeHasWaste = beforeAnalysis.hasWaste && beforeAnalysis.wasteCount > 0
  const afterIsClean = !afterAnalysis.hasWaste || afterAnalysis.wasteCount === 0
  
  // Calculate overall confidence
  // Weight: 40% before confidence, 40% after confidence, 20% logic match
  const logicMatch = beforeHasWaste && afterIsClean ? 1.0 : 0.0
  const overallConfidence =
    beforeAnalysis.overallConfidence * 0.4 +
    afterAnalysis.overallConfidence * 0.4 +
    logicMatch * 0.2
  
  // Decision logic
  let decision: VerificationDecision = 'MANUAL_REVIEW'
  
  if (overallConfidence >= config.autoApproveThreshold && beforeHasWaste && afterIsClean) {
    decision = 'AUTO_APPROVED'
  } else if (overallConfidence < config.manualReviewThreshold) {
    decision = 'MANUAL_REVIEW'
  } else {
    // Between thresholds: check if logic matches
    if (beforeHasWaste && afterIsClean) {
      // Logic matches but confidence is medium - still auto-approve if enabled
      if (config.allowAutoApprove) {
        decision = 'AUTO_APPROVED'
      } else {
        decision = 'MANUAL_REVIEW'
      }
    } else {
      // Logic doesn't match - always manual review
      decision = 'MANUAL_REVIEW'
    }
  }
  
  return { decision, confidence: overallConfidence }
}

/**
 * Main verification function
 */
export async function verifyCleanup(
  request: VerificationRequest
): Promise<VerificationResponse> {
  const config = getDMRVConfig()
  
  if (!config.enabled) {
    throw new Error('DMRV service is disabled')
  }
  
  console.log(`[DMRV] Verifying submission ${request.submissionId}...`)
  
  // Fetch images from IPFS
  let beforeImage: Buffer
  let afterImage: Buffer
  
  try {
    console.log(`[DMRV] Fetching before image from IPFS: ${request.beforeImageCid}`)
    beforeImage = await fetchImageFromIPFS(request.beforeImageCid)
    
    if (!validateImage(beforeImage)) {
      throw new Error('Invalid before image format or size')
    }
    
    console.log(`[DMRV] Fetching after image from IPFS: ${request.afterImageCid}`)
    afterImage = await fetchImageFromIPFS(request.afterImageCid)
    
    if (!validateImage(afterImage)) {
      throw new Error('Invalid after image format or size')
    }
  } catch (error) {
    console.error('[DMRV] IPFS fetch error:', error)
    throw new Error(`Failed to fetch images from IPFS: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  // Run waste detection on both images
  let beforeAnalysis: ImageAnalysis
  let afterAnalysis: ImageAnalysis
  
  try {
    console.log('[DMRV] Running waste detection on before image...')
    beforeAnalysis = await detectWaste(beforeImage, true)
    
    console.log('[DMRV] Running waste detection on after image...')
    afterAnalysis = await detectWaste(afterImage, false)
  } catch (error) {
    console.error('[DMRV] Detection error:', error)
    throw new Error(`Waste detection failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  // Make verification decision
  const { decision, confidence } = makeDecision(beforeAnalysis, afterAnalysis)
  const reasoning = generateReasoning(beforeAnalysis, afterAnalysis, decision)
  
  // Generate hashes
  const modelHash = getModelHash()
  const resultHash = getResultHash(beforeAnalysis, afterAnalysis, decision, confidence)
  
  const response: VerificationResponse = {
    decision,
    confidence,
    modelHash,
    resultHash,
    analysis: {
      before: beforeAnalysis,
      after: afterAnalysis,
      reasoning,
    },
    timestamp: Date.now(),
  }
  
  console.log(`[DMRV] Verification complete: ${decision} (confidence: ${(confidence * 100).toFixed(1)}%)`)
  
  return response
}
