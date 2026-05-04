/**
 * Admin Role Verification
 * Checks onchain if address may act as "admin" for verifier APIs:
 * - DEFAULT_ADMIN_ROLE (AccessControl super-admin), or
 * - Submission contract ADMIN_ROLE (custom; fee/reward admin — same addresses as setup-roles)
 *
 * API routes run in Node: use viem + REQUIRED_RPC_URL (same as /api/verifier/review/confirm) so reads
 * match chain-constants and do not depend on wagmi calling localhost:3000 from the server.
 * Browser: wagmi + user RPC (e.g. same-origin proxy on localhost).
 */

import {
  type Address,
  createPublicClient,
  defineChain,
  http,
} from 'viem'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

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
    name: 'ADMIN_ROLE',
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

async function isAdminViaPublicRpc(
  address: string,
  submissionAddress: Address
): Promise<boolean> {
  const client = createPublicClient({
    chain: submissionChain(),
    transport: http(REQUIRED_RPC_URL),
  })

  const defaultAdminRole = (await client.readContract({
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'DEFAULT_ADMIN_ROLE',
  })) as `0x${string}`

  const isDefaultAdmin = (await client.readContract({
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'hasRole',
    args: [defaultAdminRole, address as Address],
  })) as boolean

  if (isDefaultAdmin) return true

  const customAdminRole = (await client.readContract({
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'ADMIN_ROLE',
  })) as `0x${string}`

  return (await client.readContract({
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'hasRole',
    args: [customAdminRole, address as Address],
  })) as boolean
}

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

async function isAdminViaWagmi(address: string, submissionAddress: Address): Promise<boolean> {
  const cfg = await getWagmiConfig()
  if (!cfg) return false

  const { readContract } = await import('wagmi/actions')

  const defaultAdminRole = (await readContract(cfg, {
    chainId: REQUIRED_CHAIN_ID,
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'DEFAULT_ADMIN_ROLE',
  })) as `0x${string}`

  const isDefaultAdmin = (await readContract(cfg, {
    chainId: REQUIRED_CHAIN_ID,
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'hasRole',
    args: [defaultAdminRole, address as Address],
  })) as boolean

  if (isDefaultAdmin) return true

  const customAdminRole = (await readContract(cfg, {
    chainId: REQUIRED_CHAIN_ID,
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'ADMIN_ROLE',
  })) as `0x${string}`

  return (await readContract(cfg, {
    chainId: REQUIRED_CHAIN_ID,
    address: submissionAddress,
    abi: ROLE_CHECK_ABI,
    functionName: 'hasRole',
    args: [customAdminRole, address as Address],
  })) as boolean
}

/**
 * Check if address has admin privileges on Submission (DEFAULT_ADMIN_ROLE or ADMIN_ROLE).
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
    const ok =
      typeof window === 'undefined'
        ? await isAdminViaPublicRpc(address, submissionAddress)
        : await isAdminViaWagmi(address, submissionAddress)

    if (!ok) {
      console.warn(`⛔ Non-admin access attempt: ${address}`)
    }

    return ok
  } catch (error) {
    console.error('Error checking admin role onchain:', error)
    return false
  }
}
