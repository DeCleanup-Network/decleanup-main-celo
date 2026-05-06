/**
 * DMRV (Digital Measurement, Reporting & Verification) Types
 * Phase-1: AI-assisted image verification for cleanup submissions
 */

export interface VerificationRequest {
  submissionId: string
  beforeImageCid: string
  afterImageCid: string
  gps: {
    latitude: number
    longitude: number
  }
  timestamp: number
}

export interface DetectionResult {
  class: string
  confidence: number
  bbox?: [number, number, number, number] // [x, y, width, height]
}

export interface ImageAnalysis {
  hasWaste: boolean
  wasteCount: number
  detections: DetectionResult[]
  overallConfidence: number
}

export type VerificationDecision = 'AUTO_APPROVED' | 'MANUAL_REVIEW'

export interface VerificationResponse {
  decision: VerificationDecision
  confidence: number // 0-1 scale
  modelHash: string // Hash of model version/weights
  resultHash: string // Hash of verification result for audit
  analysis: {
    before: ImageAnalysis
    after: ImageAnalysis
    reasoning: string
  }
  timestamp: number
}

export interface DMRVConfig {
  // Confidence thresholds
  autoApproveThreshold: number // Default: 0.85
  manualReviewThreshold: number // Default: 0.60
  
  // Model configuration
  modelProvider: 'huggingface' | 'local' | 'mock'
  modelName?: string
  
  // IPFS configuration
  ipfsGateway: string
  
  // Feature flags
  enabled: boolean
  allowAutoApprove: boolean
}
