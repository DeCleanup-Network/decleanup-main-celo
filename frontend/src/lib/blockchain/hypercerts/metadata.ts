import { HypercertMetadataInput, HypercertMetadata, HypercertDimension } from './types'

/**
 * Build work_scope dimension from impact data
 */
function buildWorkScope(input: HypercertMetadataInput): HypercertDimension<string> {
  const scopes = []
  
  if (input.impactData?.locationType) {
    scopes.push(input.impactData.locationType)
  }
  if (input.impactData?.scopeOfWork) {
    scopes.push(input.impactData.scopeOfWork)
  }
  if (scopes.length === 0) {
    scopes.push('Environmental Cleanup')
  }

  return {
    name: 'Work Scope',
    value: scopes,
    excludes: [],
    display_value: scopes.join(' ∧ ')
  }
}

/**
 * Build impact_scope dimension from waste types
 */
function buildImpactScope(input: HypercertMetadataInput): HypercertDimension<string> {
  const wasteTypes = input.impactData?.wasteTypes || input.narrative?.wasteTypes || []
  
  if (wasteTypes.length === 0) {
    return {
      name: 'Impact Scope',
      value: ['All'],
      excludes: [],
      display_value: 'All'
    }
  }

  return {
    name: 'Impact Scope',
    value: wasteTypes,
    excludes: [],
    display_value: wasteTypes.join(' ∧ ')
  }
}

/**
 * Build work_timeframe dimension
 */
function buildWorkTimeframe(input: HypercertMetadataInput): HypercertDimension<number> {
  const startMs = input.summary.timeframeStart
  const endMs = input.summary.timeframeEnd
  
  const startDate = new Date(startMs).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })
  const endDate = new Date(endMs).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })

  return {
    name: 'Work Timeframe',
    value: [startMs, endMs],
    display_value: `${startDate} -> ${endDate}`
  }
}

/**
 * Build impact_timeframe dimension (indefinite upper bound)
 */
function buildImpactTimeframe(input: HypercertMetadataInput): HypercertDimension<number> {
  const startMs = input.summary.timeframeStart
  const startDate = new Date(startMs).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })

  return {
    name: 'Impact Timeframe',
    value: [startMs, 0],
    display_value: `${startDate} -> Indefinite`
  }
}

/**
 * Build contributors dimension
 */
function buildContributors(input: HypercertMetadataInput): HypercertDimension<string> {
  const contributors = [...(input.impactData?.contributors || [])]
  
  if (contributors.length === 0) {
    contributors.push(input.issuer || 'DeCleanup Network')
  }

  return {
    name: 'Contributors',
    value: contributors,
    display_value: contributors.join(', ')
  }
}

/**
 * Build rights dimension (v1 only supports Public Display)
 */
function buildRights(): HypercertDimension<string> {
  return {
    name: 'Rights',
    value: ['Public Display'],
    display_value: 'Public Display'
  }
}

/**
 * Build ERC-1155 properties/attributes from impact data
 */
function buildProperties(input: HypercertMetadataInput): Array<{ trait_type: string; value: string | number }> {
  const props: Array<{ trait_type: string; value: string | number }> = [
    {
      trait_type: 'Total Cleanups',
      value: input.summary.totalCleanups
    },
    {
      trait_type: 'Impact Reports',
      value: input.summary.totalReports
    }
  ]

  if (input.impactData?.area) {
    props.push({
      trait_type: 'Area Cleaned',
      value: `${input.impactData.area} ${input.impactData.areaUnit || 'm²'}`
    })
  }

  if (input.impactData?.weight) {
    props.push({
      trait_type: 'Weight Removed',
      value: `${input.impactData.weight} ${input.impactData.weightUnit || 'kg'}`
    })
  }

  if (input.impactData?.bags) {
    props.push({
      trait_type: 'Bags Collected',
      value: input.impactData.bags
    })
  }

  if (input.impactData?.hours !== undefined || input.impactData?.minutes !== undefined) {
    const hours = input.impactData.hours || 0
    const minutes = input.impactData.minutes || 0
    props.push({
      trait_type: 'Time Spent',
      value: `${hours}h ${minutes}m`
    })
  }

  return props
}

/**
 * Build complete Hypercert-standard metadata
 */
export function buildHypercertMetadata(input: HypercertMetadataInput): HypercertMetadata {
  const title = input.branding?.title || 'Environmental Cleanup Impact Certificate'
  const description = input.branding?.description || 
    input.impactData?.scopeOfWork || 
    input.narrative?.description || 
    'Environmental cleanup impact certificate from DeCleanup Network'
  
  const image = input.branding?.logoImageCid 
    ? `ipfs://${input.branding.logoImageCid}`
    : 'ipfs://QmPlaceholder'

  return {
    name: title,
    description: description,
    image: image,
    external_url: `https://decleanup.org/hypercert/${input.userAddress}`,
    properties: buildProperties(input),
    branding: input.branding,
    hypercert: {
      work_scope: buildWorkScope(input),
      work_timeframe: buildWorkTimeframe(input),
      impact_scope: buildImpactScope(input),
      impact_timeframe: buildImpactTimeframe(input),
      contributors: buildContributors(input),
      rights: buildRights()
    },
    version: input.version,
    generated_at: Date.now()
  }
}

/**
 * Extract impact summary from new Hypercert metadata format
 * Used by verifier UI for compatibility
 */
export function extractImpactSummaryFromMetadata(metadata: HypercertMetadata) {
  const totalCleanups = metadata.properties?.find(p => p.trait_type === 'Total Cleanups')?.value as number || 0
  const totalReports = metadata.properties?.find(p => p.trait_type === 'Impact Reports')?.value as number || 0
  
  return {
    totalCleanups,
    totalReports,
    timeframeStart: metadata.hypercert.work_timeframe.value[0],
    timeframeEnd: metadata.hypercert.work_timeframe.value[1]
  }
}
