// ---------------------------------------------------------------------------
// Hypercerts Minting – Now with Metadata Generation (v1 test milestone)
// Generates metadata for traceability, but minting remains simulated for now.
// ---------------------------------------------------------------------------

import { getAccount } from 'wagmi/actions'
import { config } from './wagmi'
import { getUserSubmissions, getCleanupDetails } from './contracts'
import { aggregateUserCleanups } from './hypercerts/aggregation'
import { buildHypercertMetadata } from './hypercerts/metadata'

export async function mintHypercert(
  _userAddress?: string,
  _hypercertNumber?: number
) {
  const userAddress = _userAddress ?? (await getAccount(config)).address ?? ''

  if (!userAddress) {
    throw new Error('No user address available')
  }

  // Fetch user's verified cleanups for metadata
  const submissions = await getUserSubmissions(userAddress as `0x${string}`)
  const verifiedCleanups = []
  let totalReports = 0
  for (const id of submissions) {
    try {
      const details = await getCleanupDetails(id)
      if (details.verified) {
        verifiedCleanups.push({
          cleanupId: id.toString(),
          verifiedAt: Number(details.timestamp),
        })
        if (details.hasImpactForm) totalReports++
      }
    } catch (error) {
      console.warn('Error fetching cleanup details:', error)
    }
  }

  // Aggregate cleanups
  const summary = aggregateUserCleanups(verifiedCleanups)

  // Build metadata
  const metadataInput = {
    userAddress,
    cleanups: verifiedCleanups,
    summary: {
      totalCleanups: summary.totalCleanups,
      totalReports,
      timeframeStart: summary.timeframeStart,
      timeframeEnd: summary.timeframeEnd,
    },
    issuer: 'DeCleanup Network',
    version: 'v1',
    narrative: {
      description: 'Environmental cleanup impact certificate from DeCleanup Network test milestone.',
      locations: [], // Would need to aggregate from cleanups
      wasteTypes: [], // Would need to aggregate
      challenges: 'Testing phase implementation',
      preventionIdeas: 'Continued environmental education and cleanup initiatives',
    },
  }

  const metadata = buildHypercertMetadata(metadataInput)

  // Simulated mint (for now)
  const result = {
    txHash: `0xSIMULATED_MINT_${Date.now()}`,
    hypercertId: _hypercertNumber ?? 0,
    owner: userAddress,
    metadata, // Include metadata for traceability
  }

  console.log('Hypercert metadata generated:', metadata)

  return result
}
