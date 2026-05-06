/**
 * DMRV Configuration
 * Loads from environment variables with sensible defaults
 */

import { DMRVConfig } from './types'

export function getDMRVConfig(): DMRVConfig {
  // Default to 'mock' if HuggingFace is not explicitly configured
  // This prevents 410 errors from deprecated HuggingFace models
  const modelProvider = process.env.DMRV_MODEL_PROVIDER || 'mock'
  
  return {
    // Confidence thresholds (0-1 scale)
    autoApproveThreshold: parseFloat(
      process.env.DMRV_AUTO_APPROVE_THRESHOLD || '0.85'
    ),
    manualReviewThreshold: parseFloat(
      process.env.DMRV_MANUAL_REVIEW_THRESHOLD || '0.60'
    ),
    
    // Model provider: 'huggingface' | 'local' | 'mock'
    // Default to 'mock' to avoid HuggingFace API issues
    modelProvider: (modelProvider === 'huggingface' && process.env.HUGGINGFACE_API_KEY) 
      ? 'huggingface' 
      : 'mock' as 'huggingface' | 'local' | 'mock',
    // Recommended models:
    // - FathomNet/trash-detector (object detection, best for waste detection)
    // - prithivMLmods/Trash-Net (image classification)
    // - rootstrap-org/waste-classifier (image classification)
    modelName: process.env.DMRV_MODEL_NAME || 'FathomNet/trash-detector',
    
    // IPFS gateway
    ipfsGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    
    // Feature flags
    enabled: process.env.DMRV_ENABLED !== 'false', // Default: enabled
    allowAutoApprove: process.env.DMRV_ALLOW_AUTO_APPROVE !== 'false', // Default: enabled
  }
}
