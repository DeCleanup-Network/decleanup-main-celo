import { Address } from 'viem'
import { readContract, writeContract, getAccount, waitForTransactionReceipt, getPublicClient } from '@wagmi/core'
import { config } from './wagmi'
import { keccak256, toBytes } from 'viem'

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

export enum CleanupStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
}

export interface CleanupDetails {
  id: bigint
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
}

/* -------------------------------------------------------------------------- */
/*                              CONTRACT ADDRESSES                            */
/* -------------------------------------------------------------------------- */

const SUBMISSION_ADDRESS =
  process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

/* -------------------------------------------------------------------------- */
/*                                   ABI                                      */
/* -------------------------------------------------------------------------- */

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'rewarded', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    name: 'createSubmission',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'dataURI', type: 'string' },
      { name: 'beforePhotoHash', type: 'string' },
      { name: 'afterPhotoHash', type: 'string' },
      { name: 'impactFormDataHash', type: 'string' },
      { name: 'lat', type: 'int256' },
      { name: 'lng', type: 'int256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'attachRecyclables',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'submissionId', type: 'uint256' },
      { name: 'recyclablesPhotoHash', type: 'string' },
      { name: 'recyclablesReceiptHash', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveSubmission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rejectSubmission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'VERIFIER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'submissionCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/* -------------------------------------------------------------------------- */
/*                             CLEANUP / SUBMISSION                            */
/* -------------------------------------------------------------------------- */

export async function submitCleanup(
  beforeHash: string,
  afterHash: string,
  lat: number,
  lng: number,
  _referrer: string | null,
  _hasImpactForm: boolean,
  _impactReportHash: string,
  _fee?: bigint
): Promise<bigint> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured. Please set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  // Convert lat/lng to int256 (scaled by 1e6 as per contract)
  // int256 in Solidity is signed, so we need to handle negative values
  const scale = 1_000_000
  const latScaled = Math.round(lat * scale)
  const lngScaled = Math.round(lng * scale)
  
  // Convert to BigInt, handling negative values correctly for int256
  // JavaScript BigInt can represent int256 values directly
  const latInt256 = BigInt(latScaled)
  const lngInt256 = BigInt(lngScaled)

  // Prepare dataURI (can be empty or contain metadata)
  const dataURI = ''

  // Referrer address (use zero address if none)
  const referrer = (_referrer && _referrer !== '0x0000000000000000000000000000000000000000') 
    ? (_referrer as Address)
    : '0x0000000000000000000000000000000000000000' as Address

  // Impact form hash (empty string if not provided)
  const impactFormDataHash = _hasImpactForm && _impactReportHash ? _impactReportHash : ''

  try {
    // Get current submission count before submission
    const submissionCountBefore = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    // Submit the transaction
    const contractConfig: any = {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'createSubmission',
      args: [
        dataURI,
        beforeHash,
        afterHash,
        impactFormDataHash,
        latInt256,
        lngInt256,
        referrer,
      ],
      account: account.address,
    }

    // Only include value if fee is provided and > 0
    if (_fee && _fee > 0n) {
      contractConfig.value = _fee
    }

    const hash = await writeContract(config, contractConfig)

    // Wait for transaction receipt
    const receipt = await waitForTransactionReceipt(config, { hash })

    // Read the new submission count to get the ID
    const submissionCountAfter = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    // The new submission ID is the count before (since it starts at 0)
    const submissionId = submissionCountBefore as bigint

    if (submissionId === undefined || submissionId === null) {
      throw new Error('Failed to get submission ID from transaction')
    }

    return submissionId
  } catch (error: any) {
    console.error('Error submitting cleanup:', error)
    throw new Error(`Failed to submit cleanup: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}

export async function getCleanupDetails(
  cleanupId: bigint
): Promise<CleanupDetails> {
  if (!SUBMISSION_ADDRESS) {
    // Local fallback (dev / MVP)
    return {
      id: cleanupId,
      user: '0x0000000000000000000000000000000000000000',
      beforePhotoHash: '',
      afterPhotoHash: '',
      timestamp: BigInt(Date.now()),
      latitude: 0n,
      longitude: 0n,
      verified: false,
      claimed: false,
      rejected: false,
      level: 0,
    }
  }

  const result: any = await readContract(config, {
    address: SUBMISSION_ADDRESS,
    abi: SUBMISSION_ABI,
    functionName: 'getSubmissionDetails',
    args: [cleanupId],
  })

  const status = Number(result.status)

  return {
    id: result.id,
    user: result.submitter as Address,
    beforePhotoHash: result.beforePhotoHash,
    afterPhotoHash: result.afterPhotoHash,
    timestamp: result.timestamp,
    latitude: result.latitude,
    longitude: result.longitude,
    verified: status === CleanupStatus.Approved,
    rejected: status === CleanupStatus.Rejected,
    claimed: result.rewarded,
    level: status === CleanupStatus.Approved ? 1 : 0,
  }
}

export async function getCleanupCounter(): Promise<bigint> {
  if (!SUBMISSION_ADDRESS) {
    return 0n
  }

  try {
    const count = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })
    return count as bigint
  } catch (error) {
    console.error('Error getting cleanup counter:', error)
    return 0n
  }
}

/* -------------------------------------------------------------------------- */
/*                                   FEES                                     */
/* -------------------------------------------------------------------------- */

export async function getSubmissionFee(): Promise<{
  fee: bigint
  enabled: boolean
}> {
  return {
    fee: 0n,
    enabled: false,
  }
}

/* -------------------------------------------------------------------------- */
/*                                   VERIFIER                                 */
/* -------------------------------------------------------------------------- */

export async function isVerifier(_address: Address): Promise<boolean> {
  if (!SUBMISSION_ADDRESS) {
    return false
  }

  try {
    // Get VERIFIER_ROLE constant from contract
    const verifierRole = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'VERIFIER_ROLE',
    })

    // Check if address has the VERIFIER_ROLE
    const hasRole = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'hasRole',
      args: [verifierRole as `0x${string}`, _address],
    })

    return hasRole as boolean
  } catch (error) {
    console.error('Error checking verifier status:', error)
    return false
  }
}

export async function verifyCleanup(
  cleanupId: bigint,
  level: number
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  try {
    const hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'approveSubmission',
      args: [cleanupId],
      account: account.address,
    })

    await waitForTransactionReceipt(config, { hash })
    return hash
  } catch (error: any) {
    console.error('Error verifying cleanup:', error)
    throw new Error(`Failed to verify cleanup: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}

export async function rejectCleanup(
  cleanupId: bigint
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  try {
    const hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'rejectSubmission',
      args: [cleanupId],
      account: account.address,
    })

    await waitForTransactionReceipt(config, { hash })
    return hash
  } catch (error: any) {
    console.error('Error rejecting cleanup:', error)
    throw new Error(`Failed to reject cleanup: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}


/* -------------------------------------------------------------------------- */
/*                                   REWARDS                                  */
/* -------------------------------------------------------------------------- */

export async function getClaimableRewards(
  _address: Address
): Promise<bigint> {
  return 0n
}

export async function getDCUBalance(_address: Address): Promise<bigint> {
  return 0n
}

/* -------------------------------------------------------------------------- */
/*                               IMPACT / LEVEL                               */
/* -------------------------------------------------------------------------- */

export async function getUserLevel(_address: Address): Promise<number> {
  return 0
}

export async function claimImpactProductFromVerification(
  cleanupId: bigint
): Promise<`0x${string}`> {
  // MVP stub: simulate tx hash
  const fakeHash = `0x${cleanupId.toString(16).padStart(64, '0')}` as `0x${string}`
  return fakeHash
}

/* -------------------------------------------------------------------------- */
/*                               HYPERCERT                                    */
/* -------------------------------------------------------------------------- */

export async function getHypercertEligibility(_: Address): Promise<{
  cleanupCount: bigint
  hypercertCount: bigint
  isEligible: boolean
}> {
  return {
    cleanupCount: 0n,
    hypercertCount: 0n,
    isEligible: false,
  }
}

/* -------------------------------------------------------------------------- */
/*                    PROFILE / STAKING / STREAK (MVP STUBS)                   */
/* -------------------------------------------------------------------------- */

export async function getStakedDCU(_: Address): Promise<bigint> {
  // Staking not implemented in MVP
  return 0n
}

export async function getUserTokenId(_: Address): Promise<bigint | null> {
  // Impact Product NFT not wired yet
  return null
}

export async function getTokenURI(_: bigint): Promise<string> {
  return ''
}

export async function getTokenURIForLevel(_: number): Promise<string> {
  return ''
}

export async function getStreakCount(_: Address): Promise<number> {
  return 0
}

export async function hasActiveStreak(_: Address): Promise<boolean> {
  return false
}

/* -------------------------------------------------------------------------- */
/*                               RECYCLABLES                                  */
/* -------------------------------------------------------------------------- */

export async function attachRecyclablesToSubmission(
  submissionId: bigint,
  recyclablesPhotoHash: string,
  recyclablesReceiptHash: string
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  try {
    const hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'attachRecyclables',
      args: [submissionId, recyclablesPhotoHash, recyclablesReceiptHash || ''],
      account: account.address,
    })

    await waitForTransactionReceipt(config, { hash })
    return hash
  } catch (error: any) {
    console.error('Error attaching recyclables:', error)
    throw new Error(`Failed to attach recyclables: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}

