/**
 * Server-only: EIP-712 signing for ClaimVault claims and eligibility from chain.
 * Use only from API routes (never expose private key to client).
 *
 * Per-recipient accounting (issued $cDCU, milestones, pending) lives in
 * `@/lib/cdcu/issued-store` (Supabase-backed, with local file fallback for dev).
 */

import 'server-only'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  hexToSignature,
  parseAbiItem,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getIssuedWei,
  getStoredMilestones,
  setMilestones,
} from '@/lib/cdcu/issued-store'

/** ClaimVault `ClaimCategory.CleanupCampaign` (same as server `CLAIM_CATEGORY.CleanupCampaign`). */
const CLEANUP_CAMPAIGN_CATEGORY = 1

const CLAIMED_EVENT = parseAbiItem(
  'event Claimed(address indexed recipient, uint256 amount, uint8 category, uint256 nonce)'
)

const REWARD_MANAGER_STATS_ABI_8 = [
  {
    type: 'function',
    name: 'getUserRewardStats',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'currentBalance', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'claimRewardsAmount', type: 'uint256' },
      { name: 'streakRewardsAmount', type: 'uint256' },
      { name: 'referralRewardsAmount', type: 'uint256' },
      { name: 'impactReportRewardsAmount', type: 'uint256' },
      { name: 'recyclablesRewardsAmount', type: 'uint256' },
    ],
  },
] as const

const REWARD_MANAGER_STATS_ABI_7 = [
  {
    type: 'function',
    name: 'getUserRewardStats',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'currentBalance', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'claimRewardsAmount', type: 'uint256' },
      { name: 'streakRewardsAmount', type: 'uint256' },
      { name: 'referralRewardsAmount', type: 'uint256' },
      { name: 'impactReportRewardsAmount', type: 'uint256' },
    ],
  },
] as const

/** Minimum DCU points (onchain reward stats total) required to be eligible to claim $cDCU. */
export const ELIGIBILITY_THRESHOLD_WEI = 50n * 10n ** 18n

/** Human-readable DCU points per $cDCU claim step (same as 50e18 wei). */
export const DCU_POINTS_PER_TRANCHE = 50

/** 1e18 scale for multiplier (e.g. 1.1 = 11e17). */
const MULTIPLIER_SCALE = 10n ** 18n
/** Campaign multiplier starts at 5x and halves every 3 months, floored to 1x. */
const CAMPAIGN_START_MULTIPLIER_WEI = 5n * 10n ** 18n
const CAMPAIGN_MIN_MULTIPLIER_WEI = 1n * 10n ** 18n
const SECONDS_PER_3_MONTH_PERIOD = 90 * 24 * 60 * 60

function getCampaignStartUnixSeconds(): number {
  const raw = process.env.CDCU_MULTIPLIER_START_DATE?.trim()
  if (!raw) return Date.parse('2026-05-01T00:00:00Z') / 1000
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return Date.parse('2026-05-01T00:00:00Z') / 1000
  return Math.floor(parsed / 1000)
}

/**
 * Time-based campaign multiplier.
 * - First 3 months: 5x
 * - Next 3 months: 2.5x
 * - Then keeps reducing by half each 3-month period, with a floor at 1x.
 */
export function getProgressiveMultiplierWei(totalPointsWei: bigint): bigint {
  if (totalPointsWei < ELIGIBILITY_THRESHOLD_WEI) return CAMPAIGN_START_MULTIPLIER_WEI
  const nowSeconds = Math.floor(Date.now() / 1000)
  const startSeconds = getCampaignStartUnixSeconds()
  const elapsed = Math.max(0, nowSeconds - startSeconds)
  const periods = Math.floor(elapsed / SECONDS_PER_3_MONTH_PERIOD)

  let multiplier = CAMPAIGN_START_MULTIPLIER_WEI
  for (let i = 0; i < periods; i++) {
    multiplier = multiplier / 2n
    if (multiplier <= CAMPAIGN_MIN_MULTIPLIER_WEI) {
      multiplier = CAMPAIGN_MIN_MULTIPLIER_WEI
      break
    }
  }
  return multiplier < CAMPAIGN_MIN_MULTIPLIER_WEI ? CAMPAIGN_MIN_MULTIPLIER_WEI : multiplier
}

/**
 * Claimable $cDCU = total points × progressiveMultiplier(points).
 * Need 50 points to unlock; once eligible, all points count.
 * E.g. 298 points, 1.5 multiplier → 298×1.5 = 447 $cDCU.
 */
export function claimableCapFromPoints(totalPointsWei: bigint): bigint {
  if (totalPointsWei < ELIGIBILITY_THRESHOLD_WEI) return 0n
  const multiplierWei = getProgressiveMultiplierWei(totalPointsWei)
  return (totalPointsWei * multiplierWei) / MULTIPLIER_SCALE
}

/** Activity multiplier (1.1 … 2.0) for `totalPointsWei`, for UI copy. */
export function getActivityMultiplierWei(totalPointsWei: bigint): bigint {
  if (totalPointsWei < ELIGIBILITY_THRESHOLD_WEI) return 0n
  return getProgressiveMultiplierWei(totalPointsWei)
}

/** Floor(P / 50 DCU) — how many 50-point milestones the user has reached. */
export function tiersReachedWei(totalPointsWei: bigint): bigint {
  return totalPointsWei / ELIGIBILITY_THRESHOLD_WEI
}

/**
 * $cDCU for a single 50-DCU tranche: milestone index `milestonesClaimed` (0 = first 0→50, 1 = 50→100, …).
 * Each claim is only this slice; the next claim requires reaching the next milestone (50 more DCU points).
 */
export function incrementalClaimWei(totalPointsWei: bigint, milestonesClaimed: number): bigint {
  if (milestonesClaimed < 0) return 0n
  const T = ELIGIBILITY_THRESHOLD_WEI
  const mc = BigInt(milestonesClaimed)
  const tiers = tiersReachedWei(totalPointsWei)
  if (tiers <= mc) return 0n

  const lowBound = mc * T
  const nextBound = (mc + 1n) * T
  const highPoints = totalPointsWei < nextBound ? totalPointsWei : nextBound
  const capHigh = claimableCapFromPoints(highPoints)
  const capLow = lowBound === 0n ? 0n : claimableCapFromPoints(lowBound)
  return capHigh > capLow ? capHigh - capLow : 0n
}

/**
 * How many 50-point tranches are already fully claimed (persisted).
 * If legacy data has `issued` but no milestones key, infer from issued vs incremental
 * sums at the current points balance, then persist the inferred value.
 */
export async function getMilestonesClaimed(
  recipient: string,
  totalPointsWei: bigint
): Promise<number> {
  const stored = await getStoredMilestones(recipient)
  if (stored !== null) return stored

  const issued = await getIssuedWei(recipient)
  if (issued === 0n) {
    await setMilestones(recipient, 0)
    return 0
  }
  let mc = 0
  let acc = 0n
  for (;;) {
    const inc = incrementalClaimWei(totalPointsWei, mc)
    if (inc === 0n) break
    if (acc + inc > issued) break
    acc += inc
    mc++
    if (mc > 100000) break
  }
  await setMilestones(recipient, mc)
  return mc
}

export const CLAIM_CATEGORY = {
  StakingVerifier: 0,
  CleanupCampaign: 1,
  PublicDistribution: 2,
  TeamDev: 3,
  VerificationTreasury: 4,
  CommunityIncentives: 5,
  Liquidity: 6,
} as const

export interface ClaimPayload {
  recipient: Address
  amount: bigint
  category: number
  nonce: bigint
  expiry: number
}

export interface SignedClaim extends ClaimPayload {
  v: number
  r: `0x${string}`
  s: `0x${string}`
}

const CELO_MAINNET_CHAIN_ID = 42220

/** Avoid hanging serverless eligibility when ClaimVault log scan is slow. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

function getChain() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11142220)
  const isMainnet = chainId === CELO_MAINNET_CHAIN_ID
  const rpc = isMainnet
    ? process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
    : process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      'https://celo-sepolia.drpc.org'
  return { id: chainId, rpc }
}

/**
 * Read user's RewardManager totalEarned points (same source as verifier eligibility).
 * Keeps cDCU claim milestones consistent with verifier requirements.
 */
export async function getClaimableAmountFromChain(recipient: Address): Promise<bigint> {
  const rewardManagerAddress = process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT as Address | undefined
  if (!rewardManagerAddress) return 0n

  const { id: chainId, rpc } = getChain()
  const client = createPublicClient({
    chain: { id: chainId, name: 'Celo', nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' }, rpcUrls: { default: { http: [rpc] } } },
    transport: http(rpc),
  })

  try {
    const stats8 = (await client.readContract({
      address: rewardManagerAddress,
      abi: REWARD_MANAGER_STATS_ABI_8,
      functionName: 'getUserRewardStats',
      args: [recipient],
    })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    return stats8[1]
  } catch {
    try {
      const stats7 = (await client.readContract({
        address: rewardManagerAddress,
        abi: REWARD_MANAGER_STATS_ABI_7,
        functionName: 'getUserRewardStats',
        args: [recipient],
      })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      return stats7[1]
    } catch {
      return 0n
    }
  }
}

/** Sum Reward Manager totalEarned across EOA + optional linked smart account. */
export async function getClaimableAmountFromChainMerged(
  recipient: Address,
  linkedAccount?: Address | null
): Promise<bigint> {
  const primary = await getClaimableAmountFromChain(recipient)
  if (!linkedAccount || linkedAccount.toLowerCase() === recipient.toLowerCase()) {
    return primary
  }
  const linked = await getClaimableAmountFromChain(linkedAccount)
  return primary + linked
}

/**
 * Count successful ClaimVault mints to `mintRecipient` for CleanupCampaign category.
 * Used on serverless hosts where the local JSON issued store is not durable across invocations.
 */
export async function getCleanupCampaignClaimCountForRecipient(mintRecipient: Address): Promise<number> {
  const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
  if (!claimVaultAddress) return 0

  const { id: chainId, rpc } = getChain()
  const client = createPublicClient({
    chain: {
      id: chainId,
      name: 'Celo',
      nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
      rpcUrls: { default: { http: [rpc] } },
    },
    transport: http(rpc),
  })

  const fromBlockRaw = process.env.CDCU_CLAIM_LOGS_FROM_BLOCK?.trim()
  const fromBlock = fromBlockRaw && /^\d+$/.test(fromBlockRaw) ? BigInt(fromBlockRaw) : 0n

  try {
    const logs = await client.getLogs({
      address: claimVaultAddress,
      event: CLAIMED_EVENT,
      args: { recipient: mintRecipient },
      fromBlock,
      toBlock: 'latest',
    })
    return logs.filter((l) => Number(l.args.category) === CLEANUP_CAMPAIGN_CATEGORY).length
  } catch (e) {
    console.warn('[getCleanupCampaignClaimCountForRecipient] getLogs failed:', e)
    return 0
  }
}

/**
 * Eligibility + caps for $cDCU.
 * Uses RewardManager totalEarned points. Each claim unlocks one 50-DCU tranche;
 * the next claim needs 50 more points (next milestone).
 *
 * @param opts.mintRecipient — optional payout address; when set, milestones are at least the
 *   on-chain CleanupCampaign claim count (fixes Vercel ephemeral file store).
 * @param opts.linkedAccount — optional smart account to merge reward points from (EOA-first).
 */
export async function getEligibilityAndClaimable(
  recipient: Address,
  opts?: { mintRecipient?: Address; linkedAccount?: Address }
): Promise<{
  totalPointsWei: bigint
  /** True when user has reached the next 50-point milestone and has a tranche to claim. */
  eligible: boolean
  /** Lifetime cap from current points (informational). */
  claimableCapWei: bigint
  milestonesClaimed: number
  /** Minimum total DCU points (wei) required to claim the next tranche: (milestonesClaimed + 1) × 50. */
  nextMilestonePointsWei: bigint
  /** $cDCU amount for the next tranche only (one claim). */
  claimableNextTrancheWei: bigint
}> {
  const totalPointsWei = await getClaimableAmountFromChainMerged(recipient, opts?.linkedAccount)
  let milestonesClaimed = await getMilestonesClaimed(recipient, totalPointsWei)
  if (opts?.linkedAccount && opts.linkedAccount.toLowerCase() !== recipient.toLowerCase()) {
    const linkedMilestones = await getMilestonesClaimed(opts.linkedAccount, totalPointsWei)
    milestonesClaimed = Math.max(milestonesClaimed, linkedMilestones)
  }
  const tiers = tiersReachedWei(totalPointsWei)
  const tierSafe = tiers > 1_000_000n ? 1_000_000 : Number(tiers)

  if (opts?.mintRecipient) {
    try {
      const onChainClaims = await withTimeout(
        getCleanupCampaignClaimCountForRecipient(opts.mintRecipient),
        12_000,
        -1
      )
      if (onChainClaims >= 0) {
        const cappedByTiers = Math.min(tierSafe, onChainClaims)
        milestonesClaimed = Math.max(milestonesClaimed, cappedByTiers)
      } else {
        console.warn(
          '[getEligibilityAndClaimable] On-chain claim count timed out; using stored milestones. Set CDCU_CLAIM_LOGS_FROM_BLOCK to ClaimVault deploy block on mainnet.'
        )
      }
    } catch (e) {
      console.warn('[getEligibilityAndClaimable] On-chain claim count failed:', e)
    }
  }

  const T = ELIGIBILITY_THRESHOLD_WEI
  const claimableNextTrancheWei = incrementalClaimWei(totalPointsWei, milestonesClaimed)
  const eligible = tiers > BigInt(milestonesClaimed) && claimableNextTrancheWei > 0n
  const claimableCapWei = claimableCapFromPoints(totalPointsWei)
  const nextMilestonePointsWei = (BigInt(milestonesClaimed) + 1n) * T
  return {
    totalPointsWei,
    eligible,
    claimableCapWei,
    milestonesClaimed,
    nextMilestonePointsWei,
    claimableNextTrancheWei,
  }
}

/** EIP-712 domain for ClaimVault (must match contract). */
export function getClaimVaultDomain(chainId: number, verifyingContract: Address) {
  return {
    name: 'ClaimVault',
    version: '1',
    chainId,
    verifyingContract,
  }
}

/** Sign a Claim for ClaimVault (server-only; requires private key). */
export async function signClaimVaultClaim(
  payload: ClaimPayload,
  chainId: number,
  verifyingContract: Address,
  privateKeyHex: `0x${string}`
): Promise<SignedClaim> {
  const account = privateKeyToAccount(privateKeyHex)
  const domain = getClaimVaultDomain(chainId, verifyingContract)
  const types = {
    Claim: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'uint8' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
  }

  const { rpc } = getChain()
  const chain = { id: chainId, name: 'Celo', nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' }, rpcUrls: { default: { http: [rpc] } } }
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  })

  const signature = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: 'Claim',
    message: {
      recipient: payload.recipient,
      amount: payload.amount,
      category: payload.category,
      nonce: payload.nonce,
      expiry: payload.expiry,
    },
  })

  const { r, s, v: vBig } = hexToSignature(signature)
  const v = Number(vBig)

  return { ...payload, v, r, s }
}

// ---------------------------------------------------------------------------
// Re-exports of the durable store API.
// The actual implementation lives in `@/lib/cdcu/issued-store` and is backed
// by Supabase in production (with a local-file fallback for dev).
// ---------------------------------------------------------------------------

export {
  getIssuedWei,
  getPendingWei,
  setPendingWei,
  getStoredMilestones,
  setMilestones,
  recordIssued,
  clearPending,
  resetIssuedAndPending,
  isSupabaseBacked,
} from '@/lib/cdcu/issued-store'
