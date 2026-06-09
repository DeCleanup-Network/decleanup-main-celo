/**
 * Impact Aggregation Types
 * 
 * Layers:
 * - ImpactEntry: Normalized submission data (from contract + IPFS)
 * - ImpactAggregate: Aggregated metrics (global or monthly)
 * - ImpactIndexCache: Internal cache management
 */

/**
 * Normalized impact data from a single verified cleanup submission
 * Source: Submission contract → IPFS impact data
 * ⚠️ Only represents APPROVED cleanups (already filtered by indexer)
 */
export interface ImpactEntry {
  // Onchain data
  submissionId: string
  submitter: string
  timestamp: number
  latitude: number
  longitude: number
  
  // Impact report data (from IPFS); normalized to base units
  campaignName?: string
  locationType: string
  areaSqm: number // Always sqm (normalized by indexer)
  weightKg: number // Always kg (normalized by indexer)
  bags: number
  totalMinutes: number // Normalized: (hours * 60) + minutes
  wasteTypes: string[]
  contributors: string[] // may contain names or wallet addresses
  
  // Metadata
  environmentalChallenges?: string
  preventionIdeas?: string
  additionalNotes?: string
  
  // Processing
  ipfsHash: string
  resolvedAt: number
}

/**
 * Aggregated global impact metrics
 * Generated from ImpactEntry[] (already approved)
 */
export interface ImpactAggregate {
  // Counts
  totalCleanups: number
  uniqueContributors: number // Count of distinct contributor identities
  totalContributorOccurrences: number // Total contributor entries across all cleanups
  
  // Area aggregation (normalized to sqm)
  totalAreaSqm: number
  totalAreaSqft: number // Converted for display
  
  // Weight aggregation (normalized to kg)
  totalWeightKg: number
  totalWeightLbs: number // Converted for display
  
  // Bags & duration (normalized)
  totalBags: number
  totalMinutes: number
  totalHours: number // Calculated from totalMinutes
  durationFormatted: string // "1,250 hours" or "52 days"
  
  // Locations
  locations: {
    count: number
    list: string[]
    topLocations: Array<{
      location: string
      cleanups: number
      percentage: number
    }>
  }
  
  // Waste breakdown
  wasteTypeBreakdown: Array<{
    type: string
    count: number
    percentage: number
  }>
  
  // Timeframe
  timeframe: {
    start: number // timestamp
    end: number // timestamp
    formatted: string // "Jan 2, 2026 - Feb 14, 2026"
  }
  
  // Metrics (passed from aggregator caller)
  verificationRate?: number // 0-100 (approved / total_submissions); optional
  averageContributorsPerCleanup: number
  
  // SDG Impact (future expansion)
  sdgMapping?: Record<string, number> // { SDG14: 500, SDG11: 300 }
  
  // Metadata
  generatedAt: number
}

/**
 * Monthly snapshot of impact
 */
export interface MonthlySummary extends ImpactAggregate {
  month: number // 1-12
  year: number // 2026
  monthFormatted: string // "February 2026"
}

/**
 * Export format for CSV/JSON
 */
export interface ImpactExport {
  format: 'csv' | 'json'
  period: 'global' | 'monthly'
  data: ImpactAggregate | MonthlySummary
  generatedAt: number
  filename: string
}

/**
 * Index cache entry (internal, not exposed)
 * Manages TTL and cache lifecycle
 */
export interface ImpactIndexCache {
  entries: ImpactEntry[]
  generatedAt: number
  expiresAt: number
  ttlMinutes: number
}
