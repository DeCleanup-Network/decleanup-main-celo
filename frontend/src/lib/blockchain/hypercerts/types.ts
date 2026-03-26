export type HypercertAggregationModel = 'PER_USER'

export interface CleanupReference {
  cleanupId: string
  verifiedAt: number
}

export interface HypercertImpactSummary {
  totalCleanups: number
  totalReports: number
  timeframeStart: number
  timeframeEnd: number
}

export interface HypercertBranding {
  logoImageCid?: string
  bannerImageCid?: string
  title?: string
  description?: string
}

export interface HypercertEligibilityResult {
  eligible: boolean
  reason?: string
  cleanupsCount: number
  reportsCount: number
  testingOverride?: boolean
}

// Hypercert Standard Dimensions (ERC-1155 + Hypercerts spec)
export interface HypercertDimension<T = string | number> {
  name: string
  value: T[]
  excludes?: T[]
  display_value: string
}

export interface HypercertMetadata {
  // ERC-1155 Standard Fields
  name: string
  description: string
  image: string
  external_url?: string
  
  // Optional ERC-1155 Fields
  properties?: Array<{
    trait_type: string
    value: string | number
  }>
  
  // Branding
  branding?: HypercertBranding
  
  // Required Hypercert Dimensions
  hypercert: {
    work_scope: HypercertDimension<string>
    work_timeframe: HypercertDimension<number>
    impact_scope: HypercertDimension<string>
    impact_timeframe: HypercertDimension<number>
    contributors: HypercertDimension<string>
    rights: HypercertDimension<string>
  }
  
  // Metadata generation info
  version: string
  generated_at: number
}

export interface HypercertMetadataInput {
  userAddress: string
  cleanups: CleanupReference[]
  summary: HypercertImpactSummary
  issuer: string
  version: string
  
  // Branding
  branding?: HypercertBranding
  
  // Impact Report Data (from IPFS)
  impactData?: {
    locationType?: string
    wasteTypes?: string[]
    area?: number
    areaUnit?: string
    weight?: number
    weightUnit?: string
    bags?: number
    hours?: number
    minutes?: number
    contributors?: string[]
    scopeOfWork?: string
    environmentalChallenges?: string
    preventionIdeas?: string
  }
  
  // Narrative (fallback if impact data missing)
  narrative?: {
    description?: string
    locations?: string[]
    wasteTypes?: string[]
    challenges?: string
    preventionIdeas?: string
  }
}

export type HypercertRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MINTED'

export interface HypercertRequest {
  id: string
  requester: string
  metadata: HypercertMetadata
  metadataCid?: string
  hypercertId?: string
  txHash?: string
  status: HypercertRequestStatus
  submittedAt: number
  reviewedAt?: number
  reviewedBy?: string
  rejectionReason?: string
}
