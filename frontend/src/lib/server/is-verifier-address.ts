import 'server-only'
import { type Address, createPublicClient, defineChain, http } from 'viem'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/chain-constants'

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'VERIFIER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { type: 'bytes32', name: 'role' },
      { type: 'address', name: 'account' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

function submissionChain() {
  return defineChain({
    id: REQUIRED_CHAIN_ID,
    name: REQUIRED_CHAIN_NAME,
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  })
}

export async function isVerifierAddressOnChain(address: string): Promise<boolean> {
  const submission = CONTRACT_ADDRESSES.VERIFICATION as Address | undefined
  if (!submission || !address) return false

  try {
    const client = createPublicClient({
      chain: submissionChain(),
      transport: http(REQUIRED_RPC_URL),
    })
    const verifierRole = (await client.readContract({
      address: submission,
      abi: SUBMISSION_ABI,
      functionName: 'VERIFIER_ROLE',
    })) as `0x${string}`

    return (await client.readContract({
      address: submission,
      abi: SUBMISSION_ABI,
      functionName: 'hasRole',
      args: [verifierRole, address as Address],
    })) as boolean
  } catch (e) {
    console.error('isVerifierAddressOnChain:', e)
    return false
  }
}
