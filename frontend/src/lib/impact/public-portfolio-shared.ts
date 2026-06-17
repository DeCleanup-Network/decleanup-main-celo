/**
 * Client-safe types and helpers for the public impact portfolio (no server-only imports).
 */
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { CleanupDetails } from '@/lib/blockchain/contracts'
import type { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import type { Address } from 'viem'
import { proxyIpfsHttpUrl } from '@/lib/utils/ipfs-gateway-proxy'

export function hashToGatewayUrl(hash: string): string {
  if (!hash) return ''
  const h = hash.trim()
  if (h.startsWith('ipfs://')) {
    const path = h.replace(/^ipfs:\/\//, '').replace(/^\/+/, '')
    const cid = path.split('/')[0]
    return getIPFSUrl(cid)
  }
  return getIPFSUrl(h)
}

/** Same as {@link hashToGatewayUrl} but for `<img src>` / media: same-origin proxy avoids Pinata CORS/CORP/429. */
export function hashToProxyDisplayUrl(hash: string): string {
  const u = hashToGatewayUrl(hash)
  if (!u) return ''
  return proxyIpfsHttpUrl(u)
}

/** Impact JSON stored with submissions (see cleanup flow). */
export type ImpactReportJson = {
  campaignName?: string
  cleanupDate?: string
  locationType?: string
  area?: string
  areaUnit?: string
  weight?: string
  weightUnit?: string
  bags?: string
  hours?: string
  minutes?: string
  wasteTypes?: string[]
  environmentalChallenges?: string
  preventionIdeas?: string
  scopeOfWork?: string
  additionalNotes?: string
  contributors?: string[]
  beforePhotoAllowed?: boolean
  afterPhotoAllowed?: boolean
  rightsAssignment?: string
}

export type EnrichedCleanup = {
  submissionId: string
  details: CleanupDetails
  impact: ImpactReportJson | null
}

export type PublicPortfolioRewards = {
  totalDcuBreakdown: number
  cleanupsDCU: number
  referralsDCU: number
  streakDCU: number
  reportsDCU: number
  recyclablesDCU: number
  hypercertsDCU: number
  verifierDCU: number
  totalEarned: number
  rewardManagerBalance: number
}

export type CumulativeImpactMetrics = {
  areaSqm: number
  weightKg: number
  bagsTotal: number
  minutesTotal: number
  wasteTypeCounts: Record<string, number>
}

/** Minted hypercert row for public portfolio disclosure. */
export type PortfolioHypercertRecord = {
  hypercertId: string
  metadataCid: string
  txHash?: string
  status: 'MINTED' | 'APPROVED' | 'PENDING' | 'REJECTED'
  workTimeframeStart?: number
  workTimeframeEnd?: number
  mintedAt?: number
  /** Public contributor identity (EOA); resolved from legacy Safe requester when needed. */
  contributorAddress?: string
}

/** Shape reference for portfolio hypercert table; not used in production payloads. */
export const PORTFOLIO_HYPERCERT_PLACEHOLDER: PortfolioHypercertRecord = {
  hypercertId: 'bafy…pending',
  metadataCid: 'bafy…pending',
  txHash: '0x…pending',
  status: 'PENDING',
}

export type PublicPortfolioPayload = {
  address: Address
  /** If smart-account submissions were merged from this address */
  mergedFromOwner?: Address
  level: number
  tokenId: bigint | null
  submissions: bigint[]
  enriched: EnrichedCleanup[]
  aggregated: ReturnType<typeof aggregateUserCleanups> | null
  verifiedCleanups: number
  verifiedWithReport: number
  contributorCleanupCount: number
  rewards: PublicPortfolioRewards
  cumulative: CumulativeImpactMetrics
  impactProductImageUrl: string | null
  hypercerts: PortfolioHypercertRecord[]
}

/** Whether to show before/after in public portfolio (default true if unset). */
export function canShowPhoto(impact: ImpactReportJson | null, which: 'before' | 'after'): boolean {
  if (!impact) return true
  const key = which === 'before' ? 'beforePhotoAllowed' : 'afterPhotoAllowed'
  const v = impact[key]
  return v !== false
}
