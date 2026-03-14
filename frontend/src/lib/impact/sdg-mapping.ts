/**
 * SDG Mapping
 * 
 * Maps waste types and cleanup activities to UN Sustainable Development Goals
 * 
 * Used by:
 * - Impact aggregation (enrichment)
 * - Landing page (SDG badges)
 * - Trinity integration (narrative building)
 * - Capital formation (impact storytelling)
 * 
 * Future: Make this configurable via admin panel or database
 */

/**
 * Waste type → SDG(s) mapping
 * 
 * Format:
 * - Key: waste type (from cleanup form)
 * - Value: Array of SDG numbers (1-17)
 * 
 * Example:
 * "Plastic waste" → [14, 12] (Life Below Water, Responsible Consumption)
 */
export const WASTE_TYPE_TO_SDG: Record<string, number[]> = {
  // Water & Marine
  'Plastic waste': [14, 12],
  'Marine debris': [14],
  'Ocean waste': [14],
  
  // Urban & Infrastructure
  'Urban waste': [11, 12],
  'Construction debris': [11, 12],
  'Concrete': [11],
  
  // Recycling & Circular Economy
  'Recyclables': [12],
  'Metal waste': [12],
  'Glass waste': [12],
  'Paper waste': [12],
  
  // Organic & Food
  'Food waste': [12, 13],
  'Organic waste': [12],
  
  // E-waste & Technology
  'E-waste': [9, 12],
  'Electronic waste': [9, 12],
  'Battery waste': [9, 12],
  
  // Hazardous
  'Chemical waste': [3, 12],
  'Toxic waste': [3, 12],
  
  // Land & Nature
  'Agricultural waste': [15, 12],
  'Forest debris': [15],
  'Soil contamination': [15],
  
  // General
  'General cleanup': [15, 11, 12],
  'Mixed waste': [12],
  'Litter': [11, 12],
  'Unknown': [12], // Default fallback
}

/**
 * SDG Descriptions (for UI display)
 * 
 * Used by landing page and reporting
 */
export const SDG_METADATA: Record<number, { name: string; color: string }> = {
  1: { name: 'No Poverty', color: '#E5243B' },
  2: { name: 'Zero Hunger', color: '#DDA250' },
  3: { name: 'Good Health', color: '#4C9F38' },
  4: { name: 'Quality Education', color: '#C6192B' },
  5: { name: 'Gender Equality', color: '#FF3A21' },
  6: { name: 'Clean Water', color: '#26BDE2' },
  7: { name: 'Affordable Energy', color: '#FCCC0A' },
  8: { name: 'Decent Work', color: '#A21E48' },
  9: { name: 'Innovation', color: '#DD1C3B' },
  10: { name: 'Reduced Inequalities', color: '#DD1C3B' },
  11: { name: 'Sustainable Cities', color: '#FD6925' },
  12: { name: 'Responsible Consumption', color: '#BF8B2E' },
  13: { name: 'Climate Action', color: '#407D52' },
  14: { name: 'Life Below Water', color: '#0A97D9' },
  15: { name: 'Life on Land', color: '#56C596' },
  16: { name: 'Peace & Justice', color: '#00689D' },
  17: { name: 'Partnerships', color: '#1F1D1D' },
}

/**
 * Get SDGs for a waste type
 * Falls back to "Unknown" if not found
 */
export function getSDGsForWasteType(wasteType: string): number[] {
  return WASTE_TYPE_TO_SDG[wasteType] || WASTE_TYPE_TO_SDG['Unknown']
}

/**
 * Get SDGs from multiple waste types (aggregated)
 * Deduplicates SDGs
 */
export function getAggregatedSDGs(wasteTypes: string[]): number[] {
  const sdgSet = new Set<number>()
  
  wasteTypes.forEach(wasteType => {
    const sdgs = getSDGsForWasteType(wasteType)
    sdgs.forEach(sdg => sdgSet.add(sdg))
  })
  
  return Array.from(sdgSet).sort((a, b) => a - b)
}

/**
 * Calculate SDG impact distribution
 * Counts occurrences across cleanup entries
 * 
 * Example output:
 * { 12: 150, 14: 50, 11: 100 } (cleanups per SDG)
 */
export function calculateSDGImpact(
  wasteTypeBreakdown: Array<{ type: string; count: number }>
): Record<number, number> {
  const sdgImpact: Record<number, number> = {}
  
  wasteTypeBreakdown.forEach(({ type, count }) => {
    const sdgs = getSDGsForWasteType(type)
    sdgs.forEach(sdg => {
      sdgImpact[sdg] = (sdgImpact[sdg] || 0) + count
    })
  })
  
  return sdgImpact
}
