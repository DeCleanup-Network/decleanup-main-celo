import { Address, formatEther, createPublicClient, http } from 'viem'
import { encodeFunctionData } from 'viem'
import { readContract, getAccount, waitForTransactionReceipt, getPublicClient } from '@wagmi/core'
import { lockedWriteContract } from '@/lib/blockchain/wallet-write-mutex'
import { REQUIRED_RPC_URL } from './chain-constants'
import {
  withContractCache,
  CONTRACT_READ_TTL_MS,
  invalidateImpactProductClaimCaches,
  invalidateSubmissionDetailsCache,
} from '@/lib/contractCache'
import { getConfig } from './get-wagmi-config'
import { REQUIRED_BLOCK_EXPLORER_URL, CONTRACT_ADDRESSES, REQUIRED_CHAIN_ID } from './chain-constants'
import { getSmartAccountAddressFromClient } from './smart-account'
import { keccak256, toBytes } from 'viem'
import { getLogs as viemGetLogs } from 'viem/actions'

/** Smart account client (e.g. from permissionless) for gasless submit. Has sendTransaction({ to, data?, value? }). */
export type GaslessClient = {
  sendTransaction: (params: { to: Address; data?: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>
  /** Present when client wraps a permissionless smart account (AA wallet). */
  accountAddress?: Address
}

/** Gasless / AA claim path — pass smart account + EOA when wagmi is not connected. */
export type GaslessClaimOptions = {
  gaslessClient?: GaslessClient
  smartAccountAddress?: Address
  eoaAddress?: Address
}

function resolveClaimIdentity(options?: GaslessClaimOptions): {
  eoaAddress: Address | undefined
  smartAccountAddress: Address | null
  gasless: boolean
} {
  const gasless = !!options?.gaslessClient
  if (gasless) {
    const smart =
      options?.smartAccountAddress ??
      options?.gaslessClient?.accountAddress ??
      getSmartAccountAddressFromClient(options?.gaslessClient) ??
      null
    return {
      eoaAddress: options?.eoaAddress,
      smartAccountAddress: smart,
      gasless: true,
    }
  }
  const account = getAccount(getConfig())
  const eoa = account.address as Address | undefined
  const smart = options?.gaslessClient
    ? getSmartAccountAddressFromClient(options.gaslessClient) ?? options.gaslessClient.accountAddress ?? null
    : null
  return { eoaAddress: eoa, smartAccountAddress: smart, gasless: false }
}

const TX_WAIT_OPTS = {
  confirmations: 1 as const,
  pollingInterval: 2000,
  timeout: 120_000,
}

function getRequiredChainPublicClient() {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return createPublicClient({
    chain: {
      id: REQUIRED_CHAIN_ID,
      name: isMainnet ? 'Celo' : 'Celo Sepolia',
      nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
      rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
    },
    transport: http(REQUIRED_RPC_URL),
  })
}

async function waitForOnChainConfirmation(
  hash: `0x${string}`,
  gasless: boolean,
  opts?: { gaslessTimeoutMs?: number }
) {
  if (gasless) {
    const { waitForGaslessUserOperationConfirmation } = await import(
      '@/lib/smart-account/wait-user-op'
    )
    const { transactionHash } = await waitForGaslessUserOperationConfirmation(hash, {
      timeoutMs: opts?.gaslessTimeoutMs ?? 240_000,
      pollMs: 3000,
    })
    const publicClient = getRequiredChainPublicClient()
    return publicClient.waitForTransactionReceipt({
      hash: transactionHash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120_000,
    })
  }
  return waitForTransactionReceipt(getConfig(), {
    chainId: REQUIRED_CHAIN_ID,
    hash,
    ...TX_WAIT_OPTS,
  })
}

/**
 * Optional on-chain hook: `Submission.claimSubmissionBonusRewards` after Impact Product mint/upgrade.
 * Default: enabled. Set `NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM=0` to skip `claimSubmissionBonusRewards` after mint/upgrade.
 */
function isSubmissionBonusClaimEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM?.trim()
  if (v === '0' || v?.toLowerCase() === 'false' || v?.toLowerCase() === 'off' || v?.toLowerCase() === 'no') {
    return false
  }
  // Default on: impact report + recyclables buckets on RewardManager need claimSubmissionBonusRewards after mint/upgrade.
  return true
}

/** True when the error is from calling a contract on wrong chain or at an address with no contract (viem "returned no data"). */
function isNoDataOrWrongChainError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const msg = (error as { message?: string }).message
  const name = (error as { name?: string }).name
  if (typeof msg === 'string' && msg.includes('returned no data')) return true
  if (name === 'ContractFunctionZeroDataError') return true
  if (typeof msg === 'string' && msg.includes('is not a contract')) return true
  return false
}

/** Impact product contract reverts when the user has not minted yet — not an error for the UI. */
function isExpectedNoImpactNftError(error: unknown): boolean {
  if (isNoDataOrWrongChainError(error)) return true
  const msg = (error as { message?: string })?.message
  if (typeof msg !== 'string') return false
  if (msg.includes('User has no NFT')) return true
  if (msg.includes('execution reverted') && msg.toLowerCase().includes('no nft')) return true
  return false
}

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
  // Additional fields from contract
  dataURI?: string
  impactFormDataHash?: string
  hasImpactForm?: boolean
  hasRecyclables?: boolean
  recyclablesPhotoHash?: string
  recyclablesReceiptHash?: string
  approver?: Address
  rewarded?: boolean
  referrer?: Address // Referrer address if user was referred
}

const SUBMISSION_ADDRESS =
  process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

const REWARD_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT as Address | undefined

const SUBMISSION_ABI = [
  {
    type: 'error',
    name: 'SUBMISSION__InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__InvalidSubmissionData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__SubmissionNotFound',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__Unauthorized',
    inputs: [{ name: 'user', type: 'address' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__AlreadyApproved',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__AlreadyRejected',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__NoRewardsAvailable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__InsufficientSubmissionFee',
    inputs: [
      { name: 'sent', type: 'uint256' },
      { name: 'required', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'SUBMISSION__RefundFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__CannotRefundApprovedSubmission',
    inputs: [{ name: 'submissionId', type: 'uint256' }    ],
  },
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
          { name: 'dataURI', type: 'string' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'impactFormDataHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'approver', type: 'address' },
          { name: 'processedTimestamp', type: 'uint256' },
          { name: 'rewarded', type: 'bool' },
          { name: 'feePaid', type: 'uint256' },
          { name: 'feeRefunded', type: 'bool' },
          { name: 'hasImpactForm', type: 'bool' },
          { name: 'hasRecyclables', type: 'bool' },
          { name: 'recyclablesPhotoHash', type: 'string' },
          { name: 'recyclablesReceiptHash', type: 'string' },
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
  {
    type: 'function',
    name: 'getSubmissionsByUser',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" }
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" }
    ],
    outputs: [],
  },
] as const

export async function submitCleanup(
  beforeHash: string,
  afterHash: string,
  lat: number,
  lng: number,
  _referrer: string | null,
  _hasImpactForm: boolean,
  _impactReportHash: string,
  _fee?: bigint,
  options?: { gaslessClient?: GaslessClient }
): Promise<bigint> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured. Please set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
  }

  const gasless = !!options?.gaslessClient
  const account = gasless ? null : getAccount(getConfig())
  if (!gasless && !account?.address) {
    throw new Error('Wallet not connected')
  }

  const scale = 1_000_000
  const latScaled = Math.round(lat * scale)
  const lngScaled = Math.round(lng * scale)
  const latInt256 = BigInt(latScaled)
  const lngInt256 = BigInt(lngScaled)
  const dataURI = `ipfs://${beforeHash}`
  const referrer = (_referrer && _referrer !== '0x0000000000000000000000000000000000000000') 
    ? (_referrer as Address)
    : '0x0000000000000000000000000000000000000000' as Address
  const trimmedImpact = (_impactReportHash || '').trim()
  if (_hasImpactForm && !trimmedImpact) {
    throw new Error(
      'Impact report was marked complete but no IPFS hash was provided. Do not submit without a successful impact report upload, or the chain will not record impact report DCU.'
    )
  }
  const impactFormDataHash = _hasImpactForm && trimmedImpact ? trimmedImpact : ''

  try {
    const submissionCountBefore = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    const args = [
      dataURI,
      beforeHash,
      afterHash,
      impactFormDataHash,
      latInt256,
      lngInt256,
      referrer,
    ] as const

    console.log('Submitting transaction with args:', {
      dataURI: dataURI.substring(0, 50) + '...',
      beforeHash: beforeHash.substring(0, 20) + '...',
      afterHash: afterHash.substring(0, 20) + '...',
      impactFormDataHash: impactFormDataHash || '(empty)',
      lat: latInt256.toString(),
      lng: lngInt256.toString(),
      referrer: referrer,
      fee: _fee?.toString() || '0',
      gasless: !!options?.gaslessClient,
    })

    let hash: `0x${string}`

    if (options?.gaslessClient) {
      const data = encodeFunctionData({
        abi: SUBMISSION_ABI,
        functionName: 'createSubmission',
        args,
      })
      hash = await options.gaslessClient.sendTransaction({
        to: SUBMISSION_ADDRESS,
        data,
        value: _fee ?? 0n,
      })
    } else {
      const contractConfig: any = {
        address: SUBMISSION_ADDRESS,
        abi: SUBMISSION_ABI,
        functionName: 'createSubmission',
        args,
        account: account!.address,
      }
      if (_fee && _fee > 0n) contractConfig.value = _fee
      hash = await lockedWriteContract(getConfig(), { ...contractConfig, chainId: REQUIRED_CHAIN_ID })
    }

    const receipt = await waitForTransactionReceipt(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    const submissionCountAfter = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    const submissionId = submissionCountBefore as bigint

    if (submissionId === undefined || submissionId === null) {
      throw new Error('Failed to get submission ID from transaction')
    }

    return submissionId
  } catch (error: any) {
    console.error('Error submitting cleanup:', error)
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    if (errorMessage.includes('RPC') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
      errorMessage = `Network error: ${errorMessage}. Please check your internet connection and try again.`
    }
    
    if (error?.data || error?.cause?.data) {
      const revertData = error.data || error.cause.data
      if (revertData) {
        errorMessage = `Transaction reverted: ${revertData}`
      }
    }
    
    throw new Error(`Failed to submit cleanup: ${errorMessage}`)
  }
}

async function getCleanupDetailsImpl(
  cleanupId: bigint
): Promise<CleanupDetails> {
  if (!SUBMISSION_ADDRESS) {
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

  try {
    const result: any = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'getSubmissionDetails',
      args: [cleanupId],
    })

    const status = Number(result.status)
    let claimed = false
    if (typeof window !== 'undefined') {
      const userAddress = result.submitter as Address
      const cleanupId = result.id
      const claimedKey = `claimed_cleanup_ids_${userAddress.toLowerCase()}`
      const claimedIds = localStorage.getItem(claimedKey)
      if (claimedIds) {
        try {
          const parsed = JSON.parse(claimedIds) as string[]
          claimed = parsed.includes(cleanupId.toString())
        } catch {
        }
      }
    }

    return {
      id: result.id,
      user: result.submitter as Address,
      beforePhotoHash: result.beforePhotoHash || '',
      afterPhotoHash: result.afterPhotoHash || '',
      timestamp: result.timestamp,
      latitude: result.latitude,
      longitude: result.longitude,
      verified: status === CleanupStatus.Approved,
      rejected: status === CleanupStatus.Rejected,
      claimed,
      level: status === CleanupStatus.Approved ? 1 : 0,
      dataURI: result.dataURI,
      impactFormDataHash: result.impactFormDataHash,
      hasImpactForm: result.hasImpactForm || false,
      hasRecyclables: result.hasRecyclables || false,
      recyclablesPhotoHash: result.recyclablesPhotoHash || '',
      recyclablesReceiptHash: result.recyclablesReceiptHash || '',
      approver: result.approver && result.approver !== '0x0000000000000000000000000000000000000000' 
        ? (result.approver as Address) 
        : undefined,
      rewarded: result.rewarded || false,
    }
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || String(error)
    const isNotFound = 
      errorMessage.includes('SUBMISSION__SubmissionNotFound') ||
      errorMessage.includes('SubmissionNotFound') ||
      errorMessage.includes('0xa503ddf5') // Error signature for SUBMISSION__SubmissionNotFound
    
    if (isNotFound) {
      console.warn(`Submission ${cleanupId.toString()} not found on contract`)
      return {
        id: cleanupId,
        user: '0x0000000000000000000000000000000000000000',
        beforePhotoHash: '',
        afterPhotoHash: '',
        timestamp: 0n,
        latitude: 0n,
        longitude: 0n,
        verified: false,
        claimed: false,
        rejected: false,
        level: 0,
      }
    }
    if (!isNoDataOrWrongChainError(error)) console.error('Error fetching cleanup details:', error)
    throw error
  }
}

export async function getCleanupDetails(cleanupId: bigint): Promise<CleanupDetails> {
  return withContractCache(
    `details:${REQUIRED_CHAIN_ID}:${cleanupId.toString()}`,
    CONTRACT_READ_TTL_MS,
    () => getCleanupDetailsImpl(cleanupId)
  )
}

/** Bypass read cache — verifier UI and other snapshots that must reflect recent mints / claims. */
export async function getCleanupDetailsFresh(cleanupId: bigint): Promise<CleanupDetails> {
  return getCleanupDetailsImpl(cleanupId)
}

export async function getCleanupCounter(): Promise<bigint> {
  if (!SUBMISSION_ADDRESS) {
    return 0n
  }

  try {
    const count = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })
    return count as bigint
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('Error getting cleanup counter:', error)
    return 0n
  }
}

async function getUserSubmissionsImpl(user: Address): Promise<bigint[]> {
  if (!SUBMISSION_ADDRESS) {
    return []
  }

  try {
    const submissionIds = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'getSubmissionsByUser',
      args: [user],
    })
    return (submissionIds as bigint[]) || []
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('Error getting user submissions:', error)
    return []
  }
}

export async function getUserSubmissions(user: Address): Promise<bigint[]> {
  return withContractCache(
    `submissions:${REQUIRED_CHAIN_ID}:${user.toLowerCase()}`,
    CONTRACT_READ_TTL_MS,
    () => getUserSubmissionsImpl(user)
  )
}

export async function getUserSubmissionsFresh(user: Address): Promise<bigint[]> {
  return getUserSubmissionsImpl(user)
}

/**
 * Get verifier rewards count - counts how many cleanups the user has verified
 * Each verification earns 1 $cDCU, so the count equals the DCU amount
 */
export async function getVerifierRewardsCount(verifierAddress: Address): Promise<number> {
  if (!SUBMISSION_ADDRESS) {
    return 0
  }

  try {
    // Get total submission count
    const totalSubmissions = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
      args: [],
    }) as bigint

    if (totalSubmissions === 0n) {
      return 0
    }

    // Normalize address for comparison
    const normalizedVerifier = verifierAddress.toLowerCase()
    
    // Check each submission to see if this user verified it
    let verifiedCount = 0
    const batchSize = 100 // Increased batch size for better performance
    const errors: Error[] = []
    
    for (let i = 0; i < Number(totalSubmissions); i += batchSize) {
      const batchPromises = []
      const end = Math.min(i + batchSize, Number(totalSubmissions))
      
      for (let j = i; j < end; j++) {
        batchPromises.push(
          getCleanupDetails(BigInt(j))
            .then(details => {
              // Check if this user verified this cleanup
              // Must be verified AND approver must match (case-insensitive)
              if (details.verified && details.approver) {
                const approverNormalized = details.approver.toLowerCase()
                if (approverNormalized === normalizedVerifier) {
                  return 1
                }
              }
              return 0
            })
            .catch((err) => {
              // Log error but don't fail completely
              errors.push(err as Error)
              return 0
            })
        )
      }
      
      const batchResults = await Promise.all(batchPromises)
      verifiedCount += batchResults.reduce((sum, count) => sum + count, 0)
    }

    // Log if there were errors (but don't fail)
    if (errors.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`[getVerifierRewardsCount] ${errors.length} errors while checking submissions (non-critical)`)
    }

    return verifiedCount
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('[getVerifierRewardsCount] Error getting verifier rewards count:', error)
    return 0
  }
}

/**
 * Get the referrer address for a user from the contract
 * Returns null if user was not referred
 */
export async function getUserReferrer(user: Address): Promise<Address | null> {
  if (!REWARD_MANAGER_ADDRESS) {
    return null
  }

  try {
    const referrer = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: REWARD_MANAGER_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'getReferrer',
          stateMutability: 'view',
          inputs: [{ name: 'invitee', type: 'address' }],
          outputs: [{ name: '', type: 'address' }],
        },
      ] as const,
      functionName: 'getReferrer',
      args: [user],
    }) as Address

    // Return null if referrer is zero address
    if (referrer === '0x0000000000000000000000000000000000000000') {
      return null
    }

    return referrer
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('Error getting user referrer:', error)
    return null
  }
}

/** Count of approved (non-rejected) submissions — must match NFT userLevel after all levels are claimed. */
async function countVerifiedCleanupsForUser(user: Address): Promise<number> {
  const submissionIds = await getUserSubmissions(user)
  let n = 0
  for (const sid of submissionIds) {
    try {
      const details = await getCleanupDetails(sid)
      if (details.verified && !details.rejected) n++
    } catch {
      /* ignore */
    }
  }
  return n
}

/**
 * Latest verified submission that can still be claimed on-chain.
 * Submissions listed in localStorage `claimed_cleanup_ids_*` are skipped entirely so users
 * cannot re-claim the same level without submitting a new cleanup (strict submit → verify → claim loop).
 */
export async function findLatestClaimableCleanup(user: Address): Promise<bigint | null> {
  try {
    try {
      const verifiedCnt = await countVerifiedCleanupsForUser(user)
      const nftLvl = await getUserLevel(user)
      if (verifiedCnt > 0 && nftLvl >= verifiedCnt) {
        console.log(
          `[findLatestClaimableCleanup] NFT level ${nftLvl} >= verified cleanups ${verifiedCnt} — no pending level claim`
        )
        return null
      }
    } catch (e) {
      console.warn('[findLatestClaimableCleanup] NFT vs verified count check failed:', e)
    }

    const submissionIds = await getUserSubmissions(user)

    if (submissionIds.length === 0) {
      return null
    }

    const sortedIds = [...submissionIds].sort((a, b) => {
      if (a > b) return -1
      if (a < b) return 1
      return 0
    })

    // Strict submit -> verify -> claim loop:
    // if the latest submission is already claimed locally, do not surface any older
    // verified cleanups as claimable. User must submit a newer cleanup first.
    if (typeof window !== 'undefined' && sortedIds.length > 0) {
      try {
        const latestSubmissionId = sortedIds[0]
        const claimedKey = `claimed_cleanup_ids_${user.toLowerCase()}`
        const claimedIdsRaw = localStorage.getItem(claimedKey)
        if (claimedIdsRaw) {
          const claimedIds = JSON.parse(claimedIdsRaw) as string[]
          if (claimedIds.includes(latestSubmissionId.toString())) {
            console.log(
              `[findLatestClaimableCleanup] Latest submission ${latestSubmissionId.toString()} already claimed — waiting for a new submission before next claim`
            )
            return null
          }
        }
      } catch {
        /* ignore malformed local storage */
      }
    }

    for (const submissionId of sortedIds) {
      try {
        const details = await getCleanupDetails(submissionId)

        const localClaimed =
          typeof window !== 'undefined'
            ? (() => {
                try {
                  const claimedKey = `claimed_cleanup_ids_${user.toLowerCase()}`
                  const claimedIds = localStorage.getItem(claimedKey)
                  if (claimedIds) {
                    const parsed = JSON.parse(claimedIds) as string[]
                    return parsed.includes(submissionId.toString())
                  }
                } catch {
                  /* ignore */
                }
                return false
              })()
            : false

        if (localClaimed) {
          console.log(
            `[findLatestClaimableCleanup] Skip ${submissionId.toString()} — already in claimed_cleanup_ids (claim again requires a new submission)`
          )
          continue
        }

        let isPreFixCleanup = false
        if (details.verified && details.rewarded && !details.rejected && REWARD_MANAGER_ADDRESS) {
          try {
            const balance = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
              address: REWARD_MANAGER_ADDRESS,
              abi: [
                {
                  type: 'function',
                  name: 'getBalance',
                  stateMutability: 'view',
                  inputs: [{ name: 'user', type: 'address' }],
                  outputs: [{ name: '', type: 'uint256' }],
                },
              ] as const,
              functionName: 'getBalance',
              args: [user],
            }) as bigint

            if (balance === 0n && details.timestamp) {
              const now = BigInt(Math.floor(Date.now() / 1000))
              const oneHourAgo = now - BigInt(3600)
              if (details.timestamp < oneHourAgo) {
                isPreFixCleanup = true
                console.warn(
                  `[findLatestClaimableCleanup] Pre-fix cleanup ${submissionId.toString()}: verified >1h ago, rewarded, balance 0 — skipping`
                )
              }
            }
          } catch (error) {
            console.warn(`[findLatestClaimableCleanup] Balance check failed for ${submissionId.toString()}:`, error)
          }
        }

        const isClaimable =
          details.user.toLowerCase() === user.toLowerCase() &&
          details.verified &&
          !details.rejected &&
          !details.claimed &&
          !isPreFixCleanup

        if (isClaimable) {
          console.log(`[findLatestClaimableCleanup] Found claimable cleanup: ${submissionId.toString()}`)
          return submissionId
        }
      } catch (error) {
        console.warn(`Failed to fetch details for submission ${submissionId}:`, error)
        continue
      }
    }

    return null
  } catch (error) {
    console.error('Error finding latest claimable cleanup:', error)
    return null
  }
}

export async function getSubmissionFee(): Promise<{
  fee: bigint
  enabled: boolean
}> {
  return {
    fee: 0n,
    enabled: false,
  }
}

export async function isVerifier(_address: Address): Promise<boolean> {
  if (!SUBMISSION_ADDRESS) {
    return false
  }

  try {
    const verifierRole = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'VERIFIER_ROLE',
    })

    const hasRole = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'hasRole',
      args: [verifierRole as `0x${string}`, _address],
    })

    return hasRole as boolean
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('Error checking verifier status:', error)
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

  const account = getAccount(getConfig())
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  // Hard guard: a verifier must never verify their own submission.
  const details = await getCleanupDetails(cleanupId)
  if (details.user && details.user.toLowerCase() === account.address.toLowerCase()) {
    throw new Error('You cannot verify your own submission.')
  }

  let hash: `0x${string}` | undefined
  try {
    console.log('Verifying cleanup:', {
      submissionId: cleanupId.toString(),
      contractAddress: SUBMISSION_ADDRESS,
      account: account.address,
    })

    hash = await lockedWriteContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'approveSubmission',
      args: [cleanupId],
      account: account.address,
    })

    console.log('Transaction hash:', hash)
    console.log('Waiting for transaction receipt...')

    // Wait for receipt with retry logic for RPC sync issues
    let receipt: any
    let retries = 0
    const maxRetries = 5
    
    while (retries < maxRetries) {
      try {
        receipt = await waitForTransactionReceipt(getConfig(), {
      chainId: REQUIRED_CHAIN_ID, 
          hash,
          confirmations: 1, // Wait for 1 confirmation
          pollingInterval: 2000, // Poll every 2 seconds
          timeout: 120000, // 120 second timeout
        })
        break // Success, exit retry loop
      } catch (waitError: any) {
        // Check if it's a "block is out of range" error
        const isBlockOutOfRange = 
          waitError?.message?.includes('block is out of range') ||
          waitError?.cause?.message?.includes('block is out of range') ||
          waitError?.cause?.details?.message?.includes('block is out of range') ||
          waitError?.cause?.code === -32019
        
        if (isBlockOutOfRange && retries < maxRetries - 1) {
          retries++
          const delay = Math.min(1000 * Math.pow(2, retries), 10000)
          console.warn(`Block out of range error (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw waitError
      }
    }

    if (!receipt) {
      throw new Error('Failed to get transaction receipt after retries')
    }

    console.log('Transaction receipt received:', receipt)
    
    if (receipt.status === 'reverted' || receipt.status === 0) {
      throw new Error('Transaction reverted onchain')
    }

    invalidateSubmissionDetailsCache(REQUIRED_CHAIN_ID, cleanupId)
    return hash
  } catch (error: any) {
    console.error('Error verifying cleanup:', error)
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    // Check for common errors
    if (errorMessage.includes('revert') || errorMessage.includes('reverted')) {
      errorMessage = `Transaction reverted: ${errorMessage}. The submission may already be verified/rejected, or you may not have the VERIFIER_ROLE.`
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `Transaction timeout: ${errorMessage}. The transaction may still be pending. Check the block explorer.`
    } else if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
      errorMessage = 'Transaction was rejected by user.'
    } else if (errorMessage.includes('block is out of range')) {
      errorMessage = `RPC sync issue: ${errorMessage}. ${hash ? `The transaction was submitted successfully (hash: ${hash}). ` : ''}Please check the block explorer to confirm.`
    }
    
    throw new Error(`Failed to verify cleanup: ${errorMessage}`)
  }
}

export async function rejectCleanup(
  cleanupId: bigint
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(getConfig())
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  let hash: `0x${string}` | undefined
  try {
    console.log('Rejecting cleanup:', {
      submissionId: cleanupId.toString(),
      contractAddress: SUBMISSION_ADDRESS,
      account: account.address,
    })

    hash = await lockedWriteContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'rejectSubmission',
      args: [cleanupId],
      account: account.address,
    })

    console.log('Transaction hash:', hash)
    console.log('Waiting for transaction receipt...')

    // Wait for receipt with retry logic for RPC sync issues
    let receipt: any
    let retries = 0
    const maxRetries = 5
    
    while (retries < maxRetries) {
      try {
        receipt = await waitForTransactionReceipt(getConfig(), {
      chainId: REQUIRED_CHAIN_ID, 
          hash,
          confirmations: 1, // Wait for 1 confirmation
          pollingInterval: 2000, // Poll every 2 seconds
          timeout: 120000, // 120 second timeout
        })
        break // Success, exit retry loop
      } catch (waitError: any) {
        // Check if it's a "block is out of range" error
        const isBlockOutOfRange = 
          waitError?.message?.includes('block is out of range') ||
          waitError?.cause?.message?.includes('block is out of range') ||
          waitError?.cause?.details?.message?.includes('block is out of range') ||
          waitError?.cause?.code === -32019
        
        if (isBlockOutOfRange && retries < maxRetries - 1) {
          retries++
          const delay = Math.min(1000 * Math.pow(2, retries), 10000) // Exponential backoff, max 10s
          console.warn(`Block out of range error (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw waitError // Re-throw if not retryable or max retries reached
      }
    }

    if (!receipt) {
      throw new Error('Failed to get transaction receipt after retries')
    }

    console.log('Transaction receipt received:', receipt)
    
    // Check if transaction failed
    if (receipt.status === 'reverted' || receipt.status === 0) {
      throw new Error('Transaction reverted onchain')
    }

    invalidateSubmissionDetailsCache(REQUIRED_CHAIN_ID, cleanupId)
    return hash
  } catch (error: any) {
    console.error('Error rejecting cleanup:', error)
    
    // Provide more detailed error messages
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    // Check for common errors
    if (errorMessage.includes('revert') || errorMessage.includes('reverted')) {
      errorMessage = `Transaction reverted: ${errorMessage}. The submission may already be verified/rejected, or you may not have the VERIFIER_ROLE.`
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `Transaction timeout: ${errorMessage}. The transaction may still be pending. Check the block explorer.`
    } else if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
      errorMessage = 'Transaction was rejected by user.'
    } else if (errorMessage.includes('block is out of range')) {
      errorMessage = `RPC sync issue: ${errorMessage}. ${hash ? `The transaction was submitted successfully (hash: ${hash}). ` : ''}Please check the block explorer to confirm.`
    }
    
    throw new Error(`Failed to reject cleanup: ${errorMessage}`)
  }
}

export async function getClaimableRewards(
  _address: Address
): Promise<bigint> {
  return 0n
}

async function getDCUBalanceImpl(userAddress: Address): Promise<bigint> {
  if (!REWARD_MANAGER_ADDRESS) {
    return 0n
  }

  try {
    const REWARD_MANAGER_BALANCE_ABI = [
      {
        type: 'function',
        name: 'getBalance',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const

    return (await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_BALANCE_ABI,
      functionName: 'getBalance',
      args: [userAddress],
    })) as bigint
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.error('Error getting participation balance:', error)
    return 0n
  }
}

export async function getDCUBalance(userAddress: Address): Promise<bigint> {
  return withContractCache(
    `dcuBalance:${REQUIRED_CHAIN_ID}:${userAddress.toLowerCase()}`,
    CONTRACT_READ_TTL_MS,
    () => getDCUBalanceImpl(userAddress)
  )
}

export async function getDCUBalanceFresh(userAddress: Address): Promise<bigint> {
  return getDCUBalanceImpl(userAddress)
}

export interface UserRewardStats {
  currentBalance: bigint
  totalEarned: bigint
  totalClaimed: bigint
  claimRewardsAmount: bigint
  streakRewardsAmount: bigint
  referralRewardsAmount: bigint
  impactReportRewardsAmount: bigint
  /** Separate onchain bucket from impact reports (5 DCU per verified recyclables submission) */
  recyclablesRewardsAmount: bigint
}

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

/** Public mapping on DCURewardManager — source of truth for recyclables bucket (7-tuple stats ABI omits this field). */
const REWARD_MANAGER_RECYCLABLES_LEDGER_ABI = [
  {
    type: 'function',
    name: 'recyclablesRewardsAmount',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

async function readRecyclablesRewardsLedger(userAddress: Address): Promise<bigint> {
  if (!REWARD_MANAGER_ADDRESS) return 0n
  try {
    return (await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_RECYCLABLES_LEDGER_ABI,
      functionName: 'recyclablesRewardsAmount',
      args: [userAddress],
    })) as bigint
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) {
      console.warn('Error reading recyclablesRewardsAmount ledger:', error)
    }
    return 0n
  }
}

function emptyUserRewardStats(): UserRewardStats {
  return {
    currentBalance: 0n,
    totalEarned: 0n,
    totalClaimed: 0n,
    claimRewardsAmount: 0n,
    streakRewardsAmount: 0n,
    referralRewardsAmount: 0n,
    impactReportRewardsAmount: 0n,
    recyclablesRewardsAmount: 0n,
  }
}

export async function getUserRewardStats(userAddress: Address): Promise<UserRewardStats> {
  if (!REWARD_MANAGER_ADDRESS) {
    return emptyUserRewardStats()
  }

  const recyclablesLedgerP = readRecyclablesRewardsLedger(userAddress)

  try {
    const result = (await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_STATS_ABI_8,
      functionName: 'getUserRewardStats',
      args: [userAddress],
    })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]

    const recyclablesLedger = await recyclablesLedgerP
    const fromTuple = result[7]
    const recyclablesRewardsAmount =
      fromTuple > recyclablesLedger ? fromTuple : recyclablesLedger
    return {
      currentBalance: result[0],
      totalEarned: result[1],
      totalClaimed: result[2],
      claimRewardsAmount: result[3],
      streakRewardsAmount: result[4],
      referralRewardsAmount: result[5],
      impactReportRewardsAmount: result[6],
      recyclablesRewardsAmount,
    }
  } catch (error8) {
    try {
      const result = (await readContract(getConfig(), {
        chainId: REQUIRED_CHAIN_ID,
        address: REWARD_MANAGER_ADDRESS,
        abi: REWARD_MANAGER_STATS_ABI_7,
        functionName: 'getUserRewardStats',
        args: [userAddress],
      })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]

      const recyclablesLedger = await recyclablesLedgerP
      return {
        currentBalance: result[0],
        totalEarned: result[1],
        totalClaimed: result[2],
        claimRewardsAmount: result[3],
        streakRewardsAmount: result[4],
        referralRewardsAmount: result[5],
        impactReportRewardsAmount: result[6],
        recyclablesRewardsAmount: recyclablesLedger,
      }
    } catch (error7) {
      try {
        await recyclablesLedgerP
      } catch {
        // ignore ledger failure when stats are unavailable
      }
      if (!isNoDataOrWrongChainError(error8) && !isNoDataOrWrongChainError(error7)) {
        console.error('Error getting user reward stats:', error8)
      }
      return emptyUserRewardStats()
    }
  }
}

export async function verifyRewardManagerSetup(): Promise<{
  /** Participation ledger readable on-chain (getBalance / stats). */
  ledgerReadable: boolean
  rewardManagerAddress: Address | null
  /** @deprecated DCURewardManager no longer exposes dcuToken (participation-only ledger). */
  dcuTokenAddress: Address | null
  error?: string
}> {
  if (!REWARD_MANAGER_ADDRESS) {
    return {
      ledgerReadable: false,
      rewardManagerAddress: null,
      dcuTokenAddress: null,
      error: 'Reward Manager address not configured. Set NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT',
    }
  }

  try {
    const REWARD_MANAGER_BALANCE_ABI = [
      {
        type: 'function',
        name: 'getBalance',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const

    await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_BALANCE_ABI,
      functionName: 'getBalance',
      args: ['0x0000000000000000000000000000000000000000'],
    })

    return {
      ledgerReadable: true,
      rewardManagerAddress: REWARD_MANAGER_ADDRESS,
      dcuTokenAddress: null,
    }
  } catch (error: any) {
    return {
      ledgerReadable: false,
      rewardManagerAddress: REWARD_MANAGER_ADDRESS,
      dcuTokenAddress: null,
      error: error?.message || 'Failed to verify setup',
    }
  }
}

async function getUserLevelImpl(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return 0
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'getUserNFTData',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'impact', type: 'uint256' },
          { name: 'level', type: 'uint256' },
        ],
      },
    ] as const

    const result = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getUserNFTData',
      args: [userAddress],
    }) as [bigint, bigint, bigint]

    return Number(result[2])
  } catch (error: unknown) {
    if (!isExpectedNoImpactNftError(error)) {
      console.warn('getUserLevel / getUserNFTData:', (error as { message?: string })?.message)
    }
    return 0
  }
}

export async function getUserLevel(userAddress: Address): Promise<number> {
  return withContractCache(
    `userLevel:${REQUIRED_CHAIN_ID}:${userAddress.toLowerCase()}`,
    CONTRACT_READ_TTL_MS,
    () => getUserLevelImpl(userAddress)
  )
}

export async function getUserLevelFresh(userAddress: Address): Promise<number> {
  return getUserLevelImpl(userAddress)
}

export type ClaimImpactProductResult = {
  hash: `0x${string}`
  nftTxHash: `0x${string}` | null
  bonusClaimed: boolean
  bonusError?: string
  impactReportRewardsWei?: bigint
  recyclablesRewardsWei?: bigint
}

export async function claimImpactProductFromVerification(
  cleanupId: bigint,
  options?: GaslessClaimOptions
): Promise<ClaimImpactProductResult> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured. Please set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
  }

  if (!REWARD_MANAGER_ADDRESS) {
    throw new Error('Reward Manager contract address not configured. Please set NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT in .env.local')
  }

  const { eoaAddress, smartAccountAddress: smartFromClient, gasless } = resolveClaimIdentity(options)
  if (!gasless && !eoaAddress) {
    throw new Error('Wallet not connected')
  }

  const cleanupDetails = await getCleanupDetails(cleanupId)
  
  if (!cleanupDetails.verified) {
    throw new Error('Cleanup is not approved. Please wait for verification.')
  }

  if (cleanupDetails.rejected) {
    throw new Error('Cleanup was rejected. Cannot claim rewards.')
  }

  const ownerLower = cleanupDetails.user.toLowerCase()
  const matchesEoa = !!(eoaAddress && ownerLower === eoaAddress.toLowerCase())
  const matchesSmart = !!(smartFromClient && ownerLower === smartFromClient.toLowerCase())

  if (!matchesEoa && !matchesSmart) {
    throw new Error('You can only claim rewards for your own cleanups.')
  }

  if (matchesSmart && !gasless) {
    throw new Error(
      'This cleanup is tied to your smart account. Unlock your wallet in Smart account settings, then try again.'
    )
  }

  if (gasless && matchesSmart && !smartFromClient) {
    throw new Error(
      'Gasless claim unavailable: smart account not ready. Unlock your wallet in Smart account settings and wait a few seconds.'
    )
  }

  /** Onchain identity that owns this cleanup (= reward/NFT recipient reads). */
  const submissionOwner = cleanupDetails.user
  /** Execute writes as Safe UserOp only when cleanup owner is the smart account. */
  const useGasless = matchesSmart && gasless
  console.log('Submission owner (claim address):', submissionOwner)
  console.log('Connected EOA:', eoaAddress ?? '(gasless — not required)')
  console.log('Smart account:', smartFromClient ?? '(none)')
  console.log('Cleanup ID:', cleanupId.toString())
  console.log('Cleanup verified:', cleanupDetails.verified)
  console.log('Cleanup rewarded (from contract):', cleanupDetails.rewarded)

  console.log('✅ Cleanup is verified - proceeding to claim flow')
  
  // Mint/upgrade must succeed before submission bonuses when both apply, or users only see recyclables/report
  // DCU while cleanup DCU (claimRewardsAmount) stays 0 — a failed mint must not be masked by a bonus tx.

  let hash: `0x${string}` | null = null
  let nftTxHash: `0x${string}` | null = null
  let bonusClaimed = false
  let bonusError: string | undefined
  let impactReportRewardsWei: bigint | undefined
  let recyclablesRewardsWei: bigint | undefined

  try {
    let nftStepRequired = false

    if (CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
      const currentTokenId = await getUserTokenId(submissionOwner)
      const currentLevel = await getUserLevel(submissionOwner)

      console.log('Current NFT state:', { tokenId: currentTokenId?.toString() ?? 'null', level: currentLevel })

      const needsMint = currentTokenId === null && currentLevel === 0
      const needsUpgrade =
        currentTokenId !== null && currentLevel > 0 && currentLevel < 10

      nftStepRequired = needsMint || needsUpgrade

      if (needsMint) {
        console.log('Minting Impact Product NFT')
        nftTxHash = await mintImpactProductNFT(useGasless ? options : undefined)
        hash = nftTxHash
        console.log('Impact Product NFT minted:', hash)
      } else if (needsUpgrade) {
        console.log(`Upgrading Impact Product NFT: level ${currentLevel} → ${currentLevel + 1}`)
        nftTxHash = await upgradeImpactProductNFT(currentTokenId, useGasless ? options : undefined)
        hash = nftTxHash
        console.log('Impact Product NFT upgraded:', hash)
      } else {
        console.log('No Impact Product mint/upgrade needed (max level or already synced)')
      }
    } else {
      throw new Error(
        'Impact Product NFT contract not configured. Set NEXT_PUBLIC_IMPACT_PRODUCT_NFT (or NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT) in the environment.'
      )
    }

    /** Optional: `claimSubmissionBonusRewards` after NFT (impact + recyclables on RewardManager). */
    const wantsSubmissionBonus = isSubmissionBonusClaimEnabled()

    // After NFT mint/upgrade, submission bonus (impact report + recyclables on RewardManager) unless env disables it.
    if (wantsSubmissionBonus) {
      const SUBMISSION_BONUS_ABI = [
        {
          type: 'function',
          name: 'claimSubmissionBonusRewards',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'submissionId', type: 'uint256' }],
          outputs: [],
        },
      ] as const

      try {
        let bonusHash: `0x${string}`
        if (useGasless) {
          const data = encodeFunctionData({
            abi: SUBMISSION_BONUS_ABI,
            functionName: 'claimSubmissionBonusRewards',
            args: [cleanupId],
          })
          bonusHash = await options!.gaslessClient!.sendTransaction({
            to: SUBMISSION_ADDRESS,
            data,
            value: 0n,
          })
        } else {
          bonusHash = await lockedWriteContract(getConfig(), {
            chainId: REQUIRED_CHAIN_ID,
            address: SUBMISSION_ADDRESS,
            abi: SUBMISSION_BONUS_ABI,
            functionName: 'claimSubmissionBonusRewards',
            args: [cleanupId],
            account: eoaAddress!,
          })
        }

        await waitForOnChainConfirmation(bonusHash, useGasless, { gaslessTimeoutMs: 300_000 })
        console.log('✅ Submission bonus rewards claimed:', bonusHash)
        bonusClaimed = true
        invalidateSubmissionDetailsCache(REQUIRED_CHAIN_ID, cleanupId)
        try {
          const d = await getCleanupDetails(cleanupId)
          const stats = await getUserRewardStats(submissionOwner)
          impactReportRewardsWei = stats.impactReportRewardsAmount
          recyclablesRewardsWei = stats.recyclablesRewardsAmount
          console.log('[Claim] Bonus submission snapshot:', {
            submissionId: cleanupId.toString(),
            hasImpactForm: d.hasImpactForm,
            hasRecyclables: d.hasRecyclables,
            impactFormDataHashLen: (d.impactFormDataHash || '').length,
            rewardManagerImpactReportDCU: formatEther(stats.impactReportRewardsAmount),
            rewardManagerRecyclablesDCU: formatEther(stats.recyclablesRewardsAmount),
          })
          if (!d.hasImpactForm && !d.hasRecyclables) {
            console.warn(
              '[Claim] This submission has no impact report hash and no recyclables onchain. ' +
                'claimSubmissionBonusRewards still succeeded but credited +0 to report/recyclables buckets. ' +
                'For new cleanups: complete the impact step (IPFS hash stored) and attach recyclables before approval, or extend the contract to combine create + recyclables in one tx.'
            )
          }
        } catch (e) {
          console.warn('[Claim] Could not read post-bonus submission / reward stats:', e)
        }
        if (!hash) hash = bonusHash
      } catch (bonusErr: unknown) {
        const message = bonusErr instanceof Error ? bonusErr.message : String(bonusErr)
        if (message.includes('BonusRewardsAlreadyClaimed')) {
          console.log('Submission bonus rewards were already claimed; continuing')
          bonusClaimed = true
          if (!hash) {
            throw new Error(
              'Submission bonuses were already claimed. Refresh the page to see updated balances.'
            )
          }
        } else if (hash || nftTxHash) {
          bonusError = message
          console.warn(
            'claimSubmissionBonusRewards failed after NFT success. User can retry claim to run bonus only.',
            bonusErr
          )
        } else {
          throw bonusErr
        }
      }
    }

    const needsBonus = wantsSubmissionBonus

    if (!hash) {
      if (nftStepRequired) {
        throw new Error('Claim flow did not complete onchain. No transaction hash returned.')
      }
      if (needsBonus) {
        throw new Error('Could not record submission bonuses. Try again in a few seconds.')
      }
      throw new Error('Nothing new to claim for this cleanup onchain.')
    }

    invalidateImpactProductClaimCaches({
      chainId: REQUIRED_CHAIN_ID,
      ownerAddress: submissionOwner,
      cleanupId,
    })
    return {
      hash,
      nftTxHash,
      bonusClaimed,
      bonusError,
      impactReportRewardsWei,
      recyclablesRewardsWei,
    }
  } catch (error: any) {
    console.error('Error claiming rewards:', error)
    
    let errorMessage = 'Unknown error'
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    }
    throw new Error(`Failed to claim rewards: ${errorMessage}`)
  }
}

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

export async function getStakedDCU(_: Address): Promise<bigint> {
  return 0n
}

export async function getUserTokenId(userAddress: Address): Promise<bigint | null> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return null
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'getUserNFTData',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'impact', type: 'uint256' },
          { name: 'level', type: 'uint256' },
        ],
      },
    ] as const

    const result = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getUserNFTData',
      args: [userAddress],
    }) as [bigint, bigint, bigint]

    return result[0]
  } catch (error: any) {
    return null
  }
}

export async function getTokenURI(tokenId: bigint): Promise<string> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return ''
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'tokenURI',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ name: '', type: 'string' }],
      },
    ] as const

    const uri = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'tokenURI',
      args: [tokenId],
    }) as string

    return uri
  } catch (error) {
    console.error('Error fetching token URI:', error)
    return ''
  }
}

export async function getTokenURIForLevel(level: number): Promise<string> {
  const metadataCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
  if (metadataCID && level > 0) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    return `${gateway}${metadataCID}/level${level}.json`
  }
  return ''
}

export async function getClaimFee(): Promise<{ fee: bigint; enabled: boolean }> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return { fee: 0n, enabled: false }
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'claimFee',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        type: 'function',
        name: 'feeEnabled',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const

    const [fee, enabled] = await Promise.all([
      readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
        address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'claimFee',
      }) as Promise<bigint>,
      readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
        address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'feeEnabled',
      }) as Promise<boolean>,
    ])

    return { fee, enabled }
  } catch (error) {
    if (!isNoDataOrWrongChainError(error)) console.warn('Failed to fetch claim fee:', error)
    return { fee: 0n, enabled: false }
  }
}

export async function mintImpactProductNFT(options?: GaslessClaimOptions): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product NFT contract address not configured')
  }

  const gasless = !!options?.gaslessClient
  const account = gasless ? null : getAccount(getConfig())
  if (!gasless && !account?.address) {
    throw new Error('Wallet not connected')
  }

  // Get claim fee
  const { fee, enabled } = await getClaimFee()
  const value = enabled ? fee : 0n

  const IMPACT_PRODUCT_ABI = [
    {
      type: 'function',
      name: 'safeMint',
      stateMutability: 'payable',
      inputs: [],
      outputs: [],
    },
  ] as const

  try {
    let hash: `0x${string}`
    if (gasless) {
      const data = encodeFunctionData({
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'safeMint',
        args: [],
      })
      hash = await options!.gaslessClient!.sendTransaction({
        to: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        data,
        value,
      })
    } else {
      hash = await lockedWriteContract(getConfig(), {
        chainId: REQUIRED_CHAIN_ID,
        address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'safeMint',
        account: account!.address,
        ...(value > 0n ? { value } : {}),
      })
    }

    await waitForOnChainConfirmation(hash, gasless, { gaslessTimeoutMs: 300_000 })

    return hash
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || 'Unknown error'
    if (errorMessage.includes('verified POI') || errorMessage.includes('not a verified POI')) {
      throw new Error(
        'Not marked as a verified Proof of Impact (POI) on the Impact Product contract — minting requires that flag. ' +
          'If your cleanup is already approved, the Submission contract may not be linked on Impact Product (deploy script should call setSubmissionContract), ' +
          'or you were approved before that fix and need the contract owner to call verifyPOI for your address. ' +
          'Ask the team to run `npx hardhat run contracts/scripts/setup-roles.ts --network celoSepolia` and retry.'
      )
    }
    throw new Error(`Failed to mint Impact Product NFT: ${errorMessage}`)
  }
}

export async function upgradeImpactProductNFT(
  tokenId: bigint,
  options?: GaslessClaimOptions
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product NFT contract address not configured')
  }

  const gasless = !!options?.gaslessClient
  const account = gasless ? null : getAccount(getConfig())
  if (!gasless && !account?.address) {
    throw new Error('Wallet not connected')
  }

  // Get claim fee
  const { fee, enabled } = await getClaimFee()
  const value = enabled ? fee : 0n

  const IMPACT_PRODUCT_ABI = [
    {
      type: 'function',
      name: 'upgradeNFT',
      stateMutability: 'payable',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [],
    },
  ] as const

  try {
    let hash: `0x${string}`
    if (gasless) {
      const data = encodeFunctionData({
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'upgradeNFT',
        args: [tokenId],
      })
      hash = await options!.gaslessClient!.sendTransaction({
        to: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        data,
        value,
      })
    } else {
      hash = await lockedWriteContract(getConfig(), {
        chainId: REQUIRED_CHAIN_ID,
        address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        abi: IMPACT_PRODUCT_ABI,
        functionName: 'upgradeNFT',
        args: [tokenId],
        account: account!.address,
        ...(value > 0n ? { value } : {}),
      })
    }

    await waitForOnChainConfirmation(hash, gasless, { gaslessTimeoutMs: 300_000 })

    return hash
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || 'Unknown error'
    if (errorMessage.includes('verified POI') || errorMessage.includes('not a verified POI')) {
      throw new Error('You must be verified as a POI (Proof of Impact) before upgrading. Please contact support.')
    }
    if (errorMessage.includes('maximum level')) {
      throw new Error('You have reached the maximum level (10).')
    }
    throw new Error(`Failed to upgrade Impact Product NFT: ${errorMessage}`)
  }
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
  recyclablesReceiptHash: string,
  options?: { gaslessClient?: GaslessClient }
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const gasless = !!options?.gaslessClient
  const account = gasless ? null : getAccount(getConfig())
  if (!gasless && !account?.address) {
    throw new Error('Wallet not connected')
  }

  const args = [submissionId, recyclablesPhotoHash, recyclablesReceiptHash || ''] as const

  try {
    let hash: `0x${string}`

    if (gasless) {
      const data = encodeFunctionData({
        abi: SUBMISSION_ABI,
        functionName: 'attachRecyclables',
        args,
      })
      hash = await options!.gaslessClient!.sendTransaction({
        to: SUBMISSION_ADDRESS,
        data,
        value: 0n,
      })
    } else {
      hash = await lockedWriteContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
        address: SUBMISSION_ADDRESS,
        abi: SUBMISSION_ABI,
        functionName: 'attachRecyclables',
        args,
        account: account!.address,
      })
    }

    await waitForOnChainConfirmation(hash, gasless)
    return hash
  } catch (error: any) {
    console.error('Error attaching recyclables:', error)
    throw new Error(`Failed to attach recyclables: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}


/* -------------------------------------------------------------------------- */
/*                            VERIFIER ROLE MANAGEMENT                        */
/* -------------------------------------------------------------------------- */

export async function grantVerifierRole(targetAddress: Address): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(getConfig())
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  if (!targetAddress || targetAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid target address')
  }

  try {
    const verifierRole = (await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'VERIFIER_ROLE',
    })) as `0x${string}`

    const hash = await lockedWriteContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'grantRole',
      args: [verifierRole, targetAddress],
      account: account.address,
    })

    await waitForTransactionReceipt(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    return hash

  } catch (error: any) {
    const msg = error?.message || error?.shortMessage || 'Unknown error'
    throw new Error(`Failed to grant VERIFIER_ROLE: ${msg}`)
  }
}
