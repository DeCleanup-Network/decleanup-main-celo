/**
 * Server-only: EIP-712 signing for ClaimVault claims and eligibility from chain.
 * Use only from API routes (never expose private key to client).
 */

import path from 'path'
import { createPublicClient, createWalletClient, http, type Address, hexToSignature } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const REWARD_MANAGER_ABI = [
  {
    type: 'function',
    name: 'dcuToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** Minimum DCU points (onchain reward stats total) required to be eligible to claim $cDCU. */
export const ELIGIBILITY_THRESHOLD_WEI = 50n * 10n ** 18n

/** 1e18 scale for multiplier (1.1 = 11e17). */
const MULTIPLIER_SCALE = 10n ** 18n
/** Minimum multiplier at 50 points = 1.1. */
const MIN_MULTIPLIER_WEI = 11n * 10n ** 17n
/** Maximum multiplier cap = 2.0. */
const MAX_MULTIPLIER_WEI = 2n * 10n ** 18n
/** One tier = +0.1 multiplier per 50 points above 50. */
const POINTS_PER_TIER_WEI = 50n * 10n ** 18n
const MULTIPLIER_PER_TIER_WEI = 1n * 10n ** 17n

/**
 * Progressive multiplier: the more DCU points (presence on the app), the higher the multiplier.
 * At 50 points: multiplier = 1.1. Each additional 50 points adds 0.1, capped at 2.0.
 * Examples: 50 → 1.1, 100 → 1.2, 150 → 1.3, 200 → 1.4, … 500+ → 2.0.
 */
export function getProgressiveMultiplierWei(totalPointsWei: bigint): bigint {
  if (totalPointsWei < ELIGIBILITY_THRESHOLD_WEI) return MIN_MULTIPLIER_WEI
  const aboveThreshold = totalPointsWei - ELIGIBILITY_THRESHOLD_WEI
  const tiers = aboveThreshold / POINTS_PER_TIER_WEI
  const bonusWei = tiers * MULTIPLIER_PER_TIER_WEI
  const multiplierWei = MIN_MULTIPLIER_WEI + (bonusWei > MAX_MULTIPLIER_WEI - MIN_MULTIPLIER_WEI ? MAX_MULTIPLIER_WEI - MIN_MULTIPLIER_WEI : bonusWei)
  return multiplierWei
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

function getChain() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11142220)
  const rpc =
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    'https://celo-sepolia.drpc.org'
  return { id: chainId, rpc }
}

/**
 * Read user's DCU token balance (same as "Total DCU" on dashboard).
 * Uses this so claim card and Total DCU show the same number and claimable = balance × multiplier.
 */
export async function getClaimableAmountFromChain(recipient: Address): Promise<bigint> {
  const rewardManagerAddress = process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT as Address | undefined
  if (!rewardManagerAddress) return 0n

  const { id: chainId, rpc } = getChain()
  const client = createPublicClient({
    chain: { id: chainId, name: 'Celo', nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' }, rpcUrls: { default: { http: [rpc] } } },
    transport: http(rpc),
  })

  const dcuTokenAddress = (await client.readContract({
    address: rewardManagerAddress,
    abi: REWARD_MANAGER_ABI,
    functionName: 'dcuToken',
  })) as Address

  const totalPointsWei = (await client.readContract({
    address: dcuTokenAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [recipient],
  })) as bigint

  return totalPointsWei
}

/**
 * Eligibility + claimable cap for $cDCU.
 * Uses DCU token balance (same as "Total DCU" on dashboard). Eligible when >= 50; claimable = balance × multiplier.
 */
export async function getEligibilityAndClaimable(
  recipient: Address
): Promise<{ totalPointsWei: bigint; eligible: boolean; claimableCapWei: bigint }> {
  const totalPointsWei = await getClaimableAmountFromChain(recipient)
  const eligible = totalPointsWei >= ELIGIBILITY_THRESHOLD_WEI
  const claimableCapWei = claimableCapFromPoints(totalPointsWei)
  return { totalPointsWei, eligible, claimableCapWei }
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

/** Record that the user successfully submitted the claim onchain (move pending → issued). */
export function recordIssued(recipient: string, amountWei: bigint): void {
  const store = loadIssuedStore()
  const issued = BigInt(store[recipient.toLowerCase()] ?? '0')
  store[recipient.toLowerCase()] = (issued + amountWei).toString()
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
  setPendingAmount(store, recipient, 0n)
  saveIssuedStore(store)
}
