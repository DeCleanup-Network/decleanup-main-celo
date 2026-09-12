import 'server-only'
import { type Address, createPublicClient, defineChain, http, isAddress } from 'viem'
import {
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

/** Matches CleanupStatus in contracts.ts */
const STATUS_APPROVED = 1
const STATUS_REJECTED = 2

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
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
      },
    ],
  },
] as const

export type OnChainSubmissionStatus = {
  submissionId: string
  submitter: Address
  verified: boolean
  rejected: boolean
}

/**
 * Read cleanup verification status from Submission contract (server-side, no wagmi).
 */
export async function getOnChainSubmissionStatus(
  submissionId: string
): Promise<OnChainSubmissionStatus | null> {
  const submission = CONTRACT_ADDRESSES.VERIFICATION as Address | undefined
  if (!submission) return null

  let id: bigint
  try {
    id = BigInt(submissionId)
  } catch {
    return null
  }

  try {
    const client = createPublicClient({
      chain: defineChain({
        id: REQUIRED_CHAIN_ID,
        name: REQUIRED_CHAIN_NAME,
        nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
        rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
      }),
      transport: http(REQUIRED_RPC_URL),
    })

    const result = await client.readContract({
      address: submission,
      abi: SUBMISSION_ABI,
      functionName: 'getSubmissionDetails',
      args: [id],
    })

    const submitter = result.submitter as Address
    const status = Number(result.status)
    if (!isAddress(submitter)) return null

    return {
      submissionId: id.toString(),
      submitter,
      verified: status === STATUS_APPROVED,
      rejected: status === STATUS_REJECTED,
    }
  } catch (e) {
    console.warn('[onchain-submission-status]', e)
    return null
  }
}
