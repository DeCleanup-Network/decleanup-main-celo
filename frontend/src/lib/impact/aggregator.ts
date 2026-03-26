/**
 * Impact Aggregator
 * 
 * Responsabilidades:
 * 1. Take normalized ImpactEntry[] from indexer
 * 2. Calculate aggregate metrics (sums, counts, breakdowns)
 * 3. Return structured ImpactAggregate
 * 4. Filter by month/year for monthly snapshots
 * 
 * Pure functions: No side effects, no external calls
 * No IPFS, no contract interaction
 * Just math and data transformation
 */

import { ImpactEntry, ImpactAggregate, MonthlySummary } from './types'
import { calculateSDGImpact } from './sdg-mapping'

// ============================================================================
// PUBLIC: Aggregate Global Impact
// ============================================================================

/**
 * Aggregate global impact from all entries
 * 
 * Calculates:
 * - Total counts (cleanups, contributors)
 * - Aggregated metrics (area, weight, time)
 * - Breakdowns (waste types, locations)
 * - Quality metrics (verification rate, averages)
 * - SDG mapping
 */
export function aggregateGlobalImpact(entries: ImpactEntry[]): ImpactAggregate {
  if (entries.length === 0) {
    return getEmptyAggregate()
  }
  
  // ========================================================================
  // COUNTS
  // ========================================================================
  
  const totalCleanups = entries.length
  
  const uniqueContributors = new Set(
    entries.flatMap(e => e.contributors)
  ).size
  
  const totalContributorOccurrences = entries.reduce(
    (sum, e) => sum + e.contributors.length,
    0
  )
  
  // ========================================================================
  // AREA AGGREGATION
  // ========================================================================
  
  const totalAreaSqm = entries.reduce((sum, e) => sum + e.areaSqm, 0)
  const totalAreaSqft = totalAreaSqm * 10.764
  
  // ========================================================================
  // WEIGHT AGGREGATION
  // ========================================================================
  
  const totalWeightKg = entries.reduce((sum, e) => sum + e.weightKg, 0)
  const totalWeightLbs = totalWeightKg * 2.20462
  
  // ========================================================================
  // TIME & BAGS AGGREGATION
  // ========================================================================
  
  const totalBags = entries.reduce((sum, e) => sum + e.bags, 0)
  const totalMinutes = entries.reduce((sum, e) => sum + e.totalMinutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const durationFormatted = formatDuration(totalMinutes)
  
  // ========================================================================
  // LOCATION BREAKDOWN
  // ========================================================================
  
  const locationMap = new Map<string, number>()
  entries.forEach(e => {
    locationMap.set(
      e.locationType,
      (locationMap.get(e.locationType) || 0) + 1
    )
  })
  
  const locationsList = Array.from(locationMap.keys()).sort()
  const topLocations = Array.from(locationMap.entries())
    .map(([location, cleanups]) => ({
      location,
      cleanups,
      percentage: (cleanups / totalCleanups) * 100,
    }))
    .sort((a, b) => b.cleanups - a.cleanups)
    .slice(0, 10) // Top 10
  
  // ========================================================================
  // WASTE TYPE BREAKDOWN
  // ========================================================================
  
  const wasteTypeMap = new Map<string, number>()
  entries.forEach(e => {
    e.wasteTypes.forEach(wasteType => {
      wasteTypeMap.set(
        wasteType,
        (wasteTypeMap.get(wasteType) || 0) + 1
      )
    })
  })
  
  const wasteTypeBreakdown = Array.from(wasteTypeMap.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: (count / entries.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
  
  // ========================================================================
  // TIMEFRAME
  // ========================================================================
  
  const timestamps = entries.map(e => e.timestamp)
  const timeframeStart = Math.min(...timestamps)
  const timeframeEnd = Math.max(...timestamps)
  
  const timeframeFormatted = formatDateRange(timeframeStart, timeframeEnd)
  
  // ========================================================================
  // CONTRIBUTORS CALCULATION
  // ========================================================================
  
  const averageContributorsPerCleanup =
    totalCleanups > 0 ? totalContributorOccurrences / totalCleanups : 0
  
  // ========================================================================
  // SDG MAPPING
  // ========================================================================
  
  const sdgMapping = calculateSDGImpact(wasteTypeBreakdown)
  
  // ========================================================================
  // BUILD AGGREGATE
  // ========================================================================
  
  const aggregate: ImpactAggregate = {
    totalCleanups,
    uniqueContributors,
    totalContributorOccurrences,
    
    totalAreaSqm,
    totalAreaSqft,
    
    totalWeightKg,
    totalWeightLbs,
    
    totalBags,
    totalMinutes,
    totalHours,
    durationFormatted,
    
    locations: {
      count: locationsList.length,
      list: locationsList,
      topLocations,
    },
    
    wasteTypeBreakdown,
    
    timeframe: {
      start: timeframeStart,
      end: timeframeEnd,
      formatted: timeframeFormatted,
    },
    
    averageContributorsPerCleanup,
    sdgMapping: Object.keys(sdgMapping).length > 0 ? sdgMapping : undefined,
    
    generatedAt: Date.now(),
  }
  
  return aggregate
}

// ============================================================================
// PUBLIC: Aggregate Monthly Impact
// ============================================================================

/**
 * Aggregate impact for a specific month/year
 * 
 * @param entries - All impact entries
 * @param month - 1-12
 * @param year - e.g., 2026
 * @returns MonthlySummary with month/year metadata
 */
export function aggregateMonthlyImpact(
  entries: ImpactEntry[],
  month: number,
  year: number
): MonthlySummary {
  // Filter entries for this month/year
  const monthStart = new Date(year, month - 1, 1).getTime()
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime()
  
  const filteredEntries = entries.filter(
    e => e.timestamp >= monthStart && e.timestamp <= monthEnd
  )
  
  // Aggregate
  const aggregate = aggregateGlobalImpact(filteredEntries)
  
  // Add month metadata
  const monthName = new Date(year, month - 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  
  const summary: MonthlySummary = {
    ...aggregate,
    month,
    year,
    monthFormatted: monthName,
  }
  
  return summary
}

// ============================================================================
// INTERNAL: Formatting Helpers
// ============================================================================

/**
 * Format duration in minutes to human-readable string
 * 
 * Examples:
 * - 60 → "1 hour"
 * - 120 → "2 hours"
 * - 1440 → "1 day"
 * - 75600 → "52 days"
 */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  
  if (hours < 24) {
    const parts = []
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
    if (minutes > 0) {
      parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`)
    }
    return parts.join(', ')
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  const parts = []
  parts.push(`${days} day${days !== 1 ? 's' : ''}`)
  if (remainingHours > 0) {
    parts.push(`${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

/**
 * Format date range
 * 
 * Examples:
 * - "Jan 2, 2026 - Feb 14, 2026"
 * - "Feb 14, 2026" (same day)
 */
function formatDateRange(startMs: number, endMs: number): string {
  const startDate = new Date(startMs)
  const endDate = new Date(endMs)
  
  const startStr = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  
  const endStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  
  if (startStr === endStr) {
    return startStr
  }
  
  return `${startStr} - ${endStr}`
}

// ============================================================================
// INTERNAL: Empty Aggregate (fallback)
// ============================================================================

/**
 * Return empty aggregate when no entries exist
 */
function getEmptyAggregate(): ImpactAggregate {
  return {
    totalCleanups: 0,
    uniqueContributors: 0,
    totalContributorOccurrences: 0,
    
    totalAreaSqm: 0,
    totalAreaSqft: 0,
    
    totalWeightKg: 0,
    totalWeightLbs: 0,
    
    totalBags: 0,
    totalMinutes: 0,
    totalHours: 0,
    durationFormatted: '0 minutes',
    
    locations: {
      count: 0,
      list: [],
      topLocations: [],
    },
    
    wasteTypeBreakdown: [],
    
    timeframe: {
      start: 0,
      end: 0,
      formatted: 'No data',
    },
    
    averageContributorsPerCleanup: 0,
    
    generatedAt: Date.now(),
  }
}
