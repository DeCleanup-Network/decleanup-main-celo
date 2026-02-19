/**
 * Admin Role Verification
 * Checks on-chain if address has DEFAULT_ADMIN_ROLE
 * LAZY: Only executes at runtime, not build time
 */

import { Address } from 'viem'

let wagmiConfigLoaded = false
let config: any = null

async function getWagmiConfig() {
  if (!wagmiConfigLoaded) {
    try {
      const { config: wagmiConfig } = await import('@/lib/blockchain/wagmi')
      config = wagmiConfig
      wagmiConfigLoaded = true
    } catch (e) {
      console.error('Failed to load wagmi config:', e)
      return null
    }
  }
  return config
}

/**
 * Check if address has DEFAULT_ADMIN_ROLE on-chain
 * CRITICAL: Must be called for every protected route
 */
export async function isAdminOnChain(address: string | Address): Promise<boolean> {
  if (!address || typeof address !== 'string') {
    console.warn('Invalid address for admin check:', address)
    return false
  }

  const submissionAddress = process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

  if (!submissionAddress) {
    console.error('SUBMISSION_ADDRESS not configured')
    return false
  }

  try {
    const cfg = await getWagmiConfig()
    if (!cfg) return false

    const { readContract } = await import('wagmi/actions')

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

    const adminRole = (await readContract(cfg, {
      address: submissionAddress,
      abi: ROLE_CHECK_ABI,
      functionName: 'DEFAULT_ADMIN_ROLE',
    })) as `0x${string}`

    const isAdmin = (await readContract(cfg, {
      address: submissionAddress,
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
