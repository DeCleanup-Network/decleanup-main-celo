/**
 * On-Chain Verification Hash Storage
 * Stores ML verification result hash on Celo blockchain
 */

import { Address } from 'viem'
import { readContract } from '@wagmi/core'
import { lockedWriteContract } from '@/lib/blockchain/wallet-write-mutex'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { keccak256, toBytes, toHex } from 'viem'

const SUBMISSION_ADDRESS = process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'storeVerificationHash',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'submissionId', type: 'uint256' },
      { name: 'hash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getVerificationHash',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
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
] as const

/**
 * Store verification hash on-chain
 * Requires VERIFIER_ROLE
 */
export async function storeVerificationHashOnChain(
  submissionId: bigint,
  hash: string
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }
  
  // Convert hash string to bytes32
  const hashBytes32 = hash.startsWith('0x') 
    ? (hash as `0x${string}`)
    : (`0x${hash}` as `0x${string}`)
  
  // Ensure it's exactly 32 bytes (64 hex chars + 0x)
  if (hashBytes32.length !== 66) {
    throw new Error(`Invalid hash length: expected 64 hex chars, got ${hashBytes32.length - 2}`)
  }
  
  try {
    const hash_tx = await lockedWriteContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'storeVerificationHash',
      args: [submissionId, hashBytes32],
    })
    
    return hash_tx
  } catch (error) {
    console.error('[On-Chain Hash] Error storing verification hash:', error)
    throw error
  }
}

/**
 * Get verification hash from chain
 */
export async function getVerificationHashFromChain(
  submissionId: bigint
): Promise<string | null> {
  if (!SUBMISSION_ADDRESS) {
    return null
  }
  
  try {
    const hash = await readContract(getConfig(), {
      chainId: REQUIRED_CHAIN_ID,
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'getVerificationHash',
      args: [submissionId],
    })
    
    // Return null if hash is zero (not set)
    if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return null
    }
    
    return hash as string
  } catch (error) {
    console.error('[On-Chain Hash] Error reading verification hash:', error)
    return null
  }
}
