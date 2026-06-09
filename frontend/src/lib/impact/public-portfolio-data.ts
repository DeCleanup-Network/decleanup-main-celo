/**
 * Read-only data for the public impact portfolio page (shareable link).
 */
import { formatEther } from 'viem'
import type { Address } from 'viem'
import {
  getUserSubmissions,
  getCleanupDetails,
  getUserLevel,
  getUserTokenId,
  getUserRewardStats,
  getVerifierRewardsCount,
  getTokenURI,
  getTokenURIForLevel,
  type UserRewardStats,
} from '@/lib/blockchain/contracts'
import type { CleanupDetails } from '@/lib/blockchain/contracts'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import { getContributorMentionStats } from '@/lib/impact/contributor-stats'
import { fetchViaIpfsGatewayProxy, proxyIpfsHttpUrl } from '@/lib/utils/ipfs-gateway-proxy'

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

/** Minted hypercert row for public portfolio disclosure (wired from API/indexer later). */
export type PortfolioHypercertRecord = {
  hypercertId: string
  metadataCid: string
  txHash?: string
  status: 'MINTED' | 'APPROVED' | 'PENDING'
  workTimeframeStart?: number
  workTimeframeEnd?: number
  mintedAt?: number
}

/** Shape reference for portfolio hypercert table; not used in production payloads. */
export const PORTFOLIO_HYPERCERT_PLACEHOLDER: PortfolioHypercertRecord = {
  hypercertId: 'bafy…pending',
  metadataCid: 'bafy…pending',
  txHash: '0x…pending',
  status: 'PENDING',
}

function normalizeArea(value: number, unit: string): number {
  if (unit === 'sqft') return value / 10.764
  return value
}

function normalizeWeight(value: number, unit: string): number {
  if (unit === 'lbs') return value / 2.20462
  return value
}

function parseImpactMetrics(impact: ImpactReportJson | null): {
  areaSqm: number
  weightKg: number
  bags: number
  minutes: number
  waste: string[]
} {
  if (!impact) {
    return { areaSqm: 0, weightKg: 0, bags: 0, minutes: 0, waste: [] }
  }
  const area = parseFloat(impact.area || '0') || 0
  const areaSqm = normalizeArea(area, impact.areaUnit || 'sqm')
  const weight = parseFloat(impact.weight || '0') || 0
  const weightKg = normalizeWeight(weight, impact.weightUnit || 'kg')
  const bags = parseInt(impact.bags || '0', 10) || 0
  const h = parseInt(impact.hours || '0', 10) || 0
  const m = parseInt(impact.minutes || '0', 10) || 0
  const waste = Array.isArray(impact.wasteTypes) ? impact.wasteTypes : []
  return { areaSqm, weightKg, bags, minutes: h * 60 + m, waste }
}

async function fetchImpactJson(hash: string): Promise<ImpactReportJson | null> {
  if (!hash) return null
  const clean = hash.split('?')[0].split('#')[0]
  const url = hashToGatewayUrl(clean)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const text = await r.text()
    if (text.trim().startsWith('<')) return null
    return JSON.parse(text) as ImpactReportJson
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function sumRewardStats(a: UserRewardStats, b: UserRewardStats): UserRewardStats {
  return {
    currentBalance: a.currentBalance + b.currentBalance,
    totalEarned: a.totalEarned + b.totalEarned,
    totalClaimed: a.totalClaimed + b.totalClaimed,
    claimRewardsAmount: a.claimRewardsAmount + b.claimRewardsAmount,
    streakRewardsAmount: a.streakRewardsAmount + b.streakRewardsAmount,
    referralRewardsAmount: a.referralRewardsAmount + b.referralRewardsAmount,
    impactReportRewardsAmount: a.impactReportRewardsAmount + b.impactReportRewardsAmount,
    recyclablesRewardsAmount: a.recyclablesRewardsAmount + b.recyclablesRewardsAmount,
  }
}

/**
 * When `?sa=` links a smart account to the profile address, submissions are merged from both;
 * Reward Manager DCU may be credited to either address; sum both.
 */
async function rewardStatsForProfile(
  rewardOwner: Address,
  submissionOwner?: Address
): Promise<UserRewardStats> {
  const primary = await getUserRewardStats(rewardOwner)
  if (
    !submissionOwner ||
    submissionOwner.toLowerCase() === rewardOwner.toLowerCase()
  ) {
    return primary
  }
  const secondary = await getUserRewardStats(submissionOwner)
  return sumRewardStats(primary, secondary)
}

/**
 * Impact Product NFT level is per address. When `?sa=` links a smart account, read level/token from both
 * profile and linked wallet and take the higher level (and matching token id for metadata).
 */
async function impactLevelForProfile(
  rewardOwner: Address,
  linkedAccount?: Address
): Promise<{ level: number; tokenId: bigint | null }> {
  if (!linkedAccount || linkedAccount.toLowerCase() === rewardOwner.toLowerCase()) {
    const [l1, t1] = await Promise.all([getUserLevel(rewardOwner), getUserTokenId(rewardOwner)])
    return { level: l1, tokenId: t1 }
  }
  const [l1, t1, l2, t2] = await Promise.all([
    getUserLevel(rewardOwner),
    getUserTokenId(rewardOwner),
    getUserLevel(linkedAccount),
    getUserTokenId(linkedAccount),
  ])
  const level = Math.max(l1, l2)
  let tokenId: bigint | null = null
  if (level === 0) {
    tokenId = null
  } else if (l1 > l2) {
    tokenId = t1
  } else if (l2 > l1) {
    tokenId = t2
  } else {
    tokenId = t1 ?? t2
  }
  return { level, tokenId }
}

async function mergeSubmissionIds(a: Address, b?: Address): Promise<bigint[]> {
  const sa = await getUserSubmissions(a)
  const sb = b ? await getUserSubmissions(b) : []
  const seen = new Set<string>()
  const out: bigint[] = []
  for (const id of [...sa, ...sb]) {
    const k = id.toString()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(id)
  }
  out.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  return out
}

async function resolveImpactProductPreview(level: number, tokenId: bigint | null): Promise<string | null> {
  if (level <= 0) return null
  const imagesCID =
    process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
  const gateway = 'https://ipfs.io/ipfs/'
  const fallback = `${gateway}${imagesCID}/${level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`}`
  try {
    let uri = ''
    if (tokenId !== null) {
      uri = await getTokenURI(tokenId)
    }
    if (!uri) {
      uri = await getTokenURIForLevel(level)
    }
    if (!uri) return proxyIpfsHttpUrl(fallback)
    const ac = new AbortController()
    const tid = setTimeout(() => ac.abort(), 8000)
    let r: Response
    try {
      const fetchUrl = uri.startsWith('ipfs://') ? hashToGatewayUrl(uri.replace('ipfs://', '')) : uri
      r = await fetchViaIpfsGatewayProxy(fetchUrl, { signal: ac.signal })
    } finally {
      clearTimeout(tid)
    }
    if (!r.ok) return proxyIpfsHttpUrl(fallback)
    const text = await r.text()
    if (text.trim().startsWith('<')) return proxyIpfsHttpUrl(fallback)
    const meta = JSON.parse(text) as { image?: string }
    if (meta?.image) {
      const img = meta.image.startsWith('ipfs://')
        ? hashToGatewayUrl(meta.image.replace('ipfs://', ''))
        : meta.image
      return proxyIpfsHttpUrl(img)
    }
  } catch {
    // ignore
  }
  return proxyIpfsHttpUrl(fallback)
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
  /** TODO: populate from /api/hypercerts/requests + onchain mint index when portfolio read path is live */
  hypercerts: PortfolioHypercertRecord[]
}

/**
 * @param rewardOwner - address used for Reward Manager / DCU (usually EOA or same as path)
 * @param opts.submissionOwner - optional: smart account that holds submissions when path is EOA
 */
export async function fetchPublicPortfolioData(
  rewardOwner: Address,
  opts?: { submissionOwner?: Address }
): Promise<PublicPortfolioPayload> {
  const submissionPrimary = opts?.submissionOwner ?? rewardOwner
  const submissionMerged =
    opts?.submissionOwner && opts.submissionOwner.toLowerCase() !== rewardOwner.toLowerCase()
      ? rewardOwner
      : undefined

  const submissionIds = await mergeSubmissionIds(submissionPrimary, submissionMerged)

  const details = await Promise.all(submissionIds.map((id) => getCleanupDetails(id).catch(() => null)))

  const enriched: EnrichedCleanup[] = []
  for (let i = 0; i < submissionIds.length; i++) {
    const d = details[i]
    if (!d) continue
    let impact: ImpactReportJson | null = null
    if (d.impactFormDataHash) {
      impact = await fetchImpactJson(d.impactFormDataHash)
    }
    enriched.push({
      submissionId: submissionIds[i].toString(),
      details: d,
      impact,
    })
  }

  const verified = enriched.filter((e) => e.details.verified && !e.details.rejected)
  const verifiedCleanups = verified.length
  const verifiedWithReport = verified.filter((e) => e.details.hasImpactForm).length

  const refs = verified.map((e) => ({
    cleanupId: e.submissionId,
    verifiedAt: Number(e.details.timestamp),
  }))
  const aggregated = refs.length > 0 ? aggregateUserCleanups(refs) : null

  let areaSqm = 0
  let weightKg = 0
  let bagsTotal = 0
  let minutesTotal = 0
  const wasteTypeCounts: Record<string, number> = {}
  for (const e of verified) {
    const m = parseImpactMetrics(e.impact)
    areaSqm += m.areaSqm
    weightKg += m.weightKg
    bagsTotal += m.bags
    minutesTotal += m.minutes
    for (const w of m.waste) {
      wasteTypeCounts[w] = (wasteTypeCounts[w] || 0) + 1
    }
  }

  const linkedForRewards =
    opts?.submissionOwner &&
    opts.submissionOwner.toLowerCase() !== rewardOwner.toLowerCase()
      ? opts.submissionOwner
      : undefined

  const [{ level, tokenId }, rewardStats, verifierPrimary, verifierLinked, contrib] = await Promise.all([
    impactLevelForProfile(rewardOwner, linkedForRewards),
    rewardStatsForProfile(rewardOwner, linkedForRewards),
    getVerifierRewardsCount(rewardOwner),
    linkedForRewards ? getVerifierRewardsCount(linkedForRewards) : Promise.resolve(0),
    getContributorMentionStats(rewardOwner).catch(() => ({
      contributorCleanupCount: 0,
      impactReportsAttributed: 0,
    })),
  ])
  const verifierCount = verifierPrimary + verifierLinked

  const cleanupsDCU = Number(formatEther(rewardStats.claimRewardsAmount))
  const referralsDCU = Number(formatEther(rewardStats.referralRewardsAmount))
  const streakDCU = Number(formatEther(rewardStats.streakRewardsAmount))
  const reportsDCU = Number(formatEther(rewardStats.impactReportRewardsAmount))
  const recyclablesDCU = Number(formatEther(rewardStats.recyclablesRewardsAmount))
  const hypercertsDCU = 0
  const verifierDCU = verifierCount
  const totalDcuBreakdown =
    cleanupsDCU +
    referralsDCU +
    streakDCU +
    reportsDCU +
    recyclablesDCU +
    hypercertsDCU +
    verifierDCU
  const totalEarned = Number(formatEther(rewardStats.totalEarned))
  const rewardManagerBalance = Number(formatEther(rewardStats.currentBalance))

  const impactProductImageUrl = await resolveImpactProductPreview(level, tokenId)

  return {
    address: rewardOwner,
    mergedFromOwner: submissionMerged,
    level,
    tokenId,
    submissions: submissionIds,
    enriched,
    aggregated,
    verifiedCleanups,
    verifiedWithReport,
    contributorCleanupCount: contrib.contributorCleanupCount,
    rewards: {
      totalDcuBreakdown,
      cleanupsDCU,
      referralsDCU,
      streakDCU,
      reportsDCU,
      recyclablesDCU,
      hypercertsDCU,
      verifierDCU,
      totalEarned,
      rewardManagerBalance,
    },
    cumulative: {
      areaSqm,
      weightKg,
      bagsTotal,
      minutesTotal,
      wasteTypeCounts,
    },
    impactProductImageUrl,
    // TODO: fetchHypercertRequestsByUser + filter MINTED rows into PortfolioHypercertRecord[]
    hypercerts: [],
  }
}

/** Whether to show before/after in public portfolio (default true if unset). */
export function canShowPhoto(impact: ImpactReportJson | null, which: 'before' | 'after'): boolean {
  if (!impact) return true
  const key = which === 'before' ? 'beforePhotoAllowed' : 'afterPhotoAllowed'
  const v = impact[key]
  return v !== false
}
