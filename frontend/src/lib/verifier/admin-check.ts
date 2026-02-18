/**
 * Admin Role Verification
 * Checks on-chain if address has DEFAULT_ADMIN_ROLE
 */

import { readContract } from 'wagmi/actions'
import { config } from '@/lib/blockchain/wagmi'
import { Address } from 'viem'

const SUBMISSION_ADDRESS = process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

/**
 * Minimal ABI for role checking
 */
const ROLE_CHECK_ABI = [
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
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

/**
 * Check if address has DEFAULT_ADMIN_ROLE on-chain
 * CRITICAL: Must be called for every protected route
 */
export async function isAdminOnChain(address: string | Address): Promise<boolean> {
  if (!address || typeof address !== 'string') {
    console.warn('Invalid address for admin check:', address)
    return false
  }

  if (!SUBMISSION_ADDRESS) {
    console.error('SUBMISSION_ADDRESS not configured')
    return false
  }

  try {
    // Get DEFAULT_ADMIN_ROLE constant from contract
    const adminRole = (await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: ROLE_CHECK_ABI,
      functionName: 'DEFAULT_ADMIN_ROLE',
    })) as `0x${string}`

    // Check if address has admin role
    const isAdmin = (await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: ROLE_CHECK_ABI,
      functionName: 'hasRole',
      args: [adminRole, address as Address],
    })) as boolean

    if (!isAdmin) {
      console.warn(`⛔ Non-admin access attempt: ${address}`)
    }

    return isAdmin
  } catch (error) {
    console.error('Error checking admin role on-chain:', error)
    return false
  }
}
