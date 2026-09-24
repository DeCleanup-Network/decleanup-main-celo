import type { Address } from 'viem'

/** Live Base Mini App Verification proxy (`0x69715d43…`). */
export const BASE_MINIAPP_VERIFICATION_ABI = [
  {
    type: 'function',
    name: 'submitCleanup',
    stateMutability: 'payable',
    inputs: [
      { name: 'beforePhotoHash', type: 'string' },
      { name: 'afterPhotoHash', type: 'string' },
      { name: 'latitude', type: 'uint256' },
      { name: 'longitude', type: 'uint256' },
      { name: 'referrerAddress', type: 'address' },
      { name: 'hasImpactForm', type: 'bool' },
      { name: 'impactReportHash', type: 'string' },
    ],
    outputs: [{ name: 'cleanupId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'verifyCleanup',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'cleanupId', type: 'uint256' },
      { name: 'level', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rejectCleanup',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'cleanupId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimImpactProduct',
    stateMutability: 'payable',
    inputs: [{ name: 'cleanupId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCleanup',
    stateMutability: 'view',
    inputs: [{ name: 'cleanupId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'latitude', type: 'uint256' },
          { name: 'longitude', type: 'uint256' },
          { name: 'verified', type: 'bool' },
          { name: 'claimed', type: 'bool' },
          { name: 'rejected', type: 'bool' },
          { name: 'level', type: 'uint8' },
          { name: 'referrer', type: 'address' },
          { name: 'hasImpactForm', type: 'bool' },
          { name: 'impactReportHash', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'cleanupCounter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isVerifier',
    stateMutability: 'view',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getClaimFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'fee', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getSubmissionFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'fee', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'CleanupSubmitted',
    inputs: [
      { name: 'cleanupId', type: 'uint256', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

export const BASE_MINIAPP_POINTS_ABI = [
  {
    type: 'function',
    name: 'getPointsBalance',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPointsClaimed',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const BASE_MINIAPP_NFT_ABI = [
  {
    type: 'function',
    name: 'userCurrentLevel',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getUserLevel',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getUserTokenId',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

/** Dashboard/Celo stats use 18-decimal DCU. Base Mini App points are whole numbers. */
export function basePointsToWei(points: bigint): bigint {
  return points * 10n ** 18n
}

export function nextBaseImpactLevel(currentLevel: number): number {
  if (!Number.isFinite(currentLevel) || currentLevel < 0) return 1
  return Math.min(10, Math.max(1, Math.floor(currentLevel) + 1))
}

export type BaseMiniAppCleanup = {
  user: Address
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: Address
  hasImpactForm: boolean
  impactReportHash: string
}
