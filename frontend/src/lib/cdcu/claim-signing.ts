/**
 * Server-only: EIP-712 signing for ClaimVault claims and eligibility from chain.
 * Use only from API routes (never expose private key to client).
 */

import path from 'path'
import { createPublicClient, createWalletClient, http, type Address, hexToSignature } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

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

function milestonesStoreKey(recipientLower: string): string {
  return `${recipientLower}:milestones`
}

/**
 * How many 50-point tranches are already fully claimed (persisted).
 * If legacy data has `issued` but no milestones key, infer from issued vs incremental sums at current P.
 */
export function getMilestonesClaimed(
  store: Record<string, string>,
  recipient: string,
  totalPointsWei: bigint
): number {
  const key = recipient.toLowerCase()
  const mk = milestonesStoreKey(key)
  const raw = store[mk]
  if (raw !== undefined && raw !== '') {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const issued = BigInt(store[key] ?? '0')
  if (issued === 0n) {
    store[mk] = '0'
    saveIssuedStore(store)
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
  store[mk] = String(mc)
  saveIssuedStore(store)
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

/**
 * Eligibility + caps for $cDCU.
 * Uses RewardManager totalEarned points. Each claim unlocks one 50-DCU tranche;
 * the next claim needs 50 more points (next milestone).
 */
export async function getEligibilityAndClaimable(recipient: Address): Promise<{
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
  const totalPointsWei = await getClaimableAmountFromChain(recipient)
  const store = loadIssuedStore()
  const milestonesClaimed = getMilestonesClaimed(store, recipient, totalPointsWei)
  const T = ELIGIBILITY_THRESHOLD_WEI
  const tiers = tiersReachedWei(totalPointsWei)
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

/** Default path for "already issued" store when CLAIM_VAULT_ISSUED_STORE_PATH is not set. */
export const DEFAULT_ISSUED_STORE_PATH = path.join(process.cwd(), 'data', 'cdcu-issued.json')

function getIssuedStorePath(): string {
  return process.env.CLAIM_VAULT_ISSUED_STORE_PATH || DEFAULT_ISSUED_STORE_PATH
}

/** Load total $cDCU already issued per recipient (file store). */
export function loadIssuedStore(): Record<string, string> {
  const storePath = getIssuedStorePath()
  try {
    const fs = require('fs')
    if (!fs.existsSync(storePath)) return {}
    const data = fs.readFileSync(storePath, 'utf-8')
    return JSON.parse(data) as Record<string, string>
  } catch {
    return {}
  }
}

/** Save total $cDCU already issued per recipient. */
export function saveIssuedStore(store: Record<string, string>): void {
  const storePath = getIssuedStorePath()
  try {
    const fs = require('fs')
    const dir = path.dirname(storePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
  } catch (e) {
    console.error('Failed to save issued store:', e)
  }
}

/** Key for pending (signed but not yet submitted onchain) amount per recipient. */
export function pendingKey(recipient: string): string {
  return `pending_${recipient.toLowerCase()}`
}

/** Get pending amount for recipient (signed but not yet confirmed onchain). */
export function getPendingAmount(store: Record<string, string>, recipient: string): bigint {
  return BigInt(store[pendingKey(recipient)] ?? '0')
}

/** Set pending amount when we issue a signature; clear when tx confirms or user cancels. */
export function setPendingAmount(store: Record<string, string>, recipient: string, amountWei: bigint): void {
  const key = pendingKey(recipient)
  if (amountWei === 0n) delete store[key]
  else store[key] = amountWei.toString()
}

/** Record that the user successfully submitted the claim onchain (move pending → issued). Advances one 50-DCU tranche. */
export function recordIssued(recipient: string, amountWei: bigint): void {
  const store = loadIssuedStore()
  const key = recipient.toLowerCase()
  const issued = BigInt(store[key] ?? '0')
  store[key] = (issued + amountWei).toString()
  const mk = milestonesStoreKey(key)
  const mc = parseInt(store[mk] ?? '0', 10) || 0
  store[mk] = String(mc + 1)
  setPendingAmount(store, recipient, 0n)
  saveIssuedStore(store)
}

/** Clear pending for recipient so they can request a new signature (e.g. after cancelling the tx). */
export function clearPending(recipient: string): void {
  const store = loadIssuedStore()
  setPendingAmount(store, recipient, 0n)
  saveIssuedStore(store)
}

/** Reset issued and pending for an address (unlock so they can claim again). Use when tx failed but backend had recorded it. */
export function resetIssuedAndPending(recipient: string): void {
  const store = loadIssuedStore()
  const key = recipient.toLowerCase()
  delete store[key]
  delete store[milestonesStoreKey(key)]
  setPendingAmount(store, recipient, 0n)
  saveIssuedStore(store)
}
