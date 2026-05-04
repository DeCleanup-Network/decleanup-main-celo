/**
 * Hypercert Client Setup
 * Creates and configures Hypercerts SDK client for Celo
 */

'use client'

import { HypercertClient, TransferRestrictions } from '@hypercerts-org/sdk'
import { getWalletClient, getAccount, getPublicClient } from '@wagmi/core'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/wagmi'
import { getConfig } from './get-wagmi-config'
import { HYPERCERTS_CONFIG } from './hypercerts/config'

let hypercertClient: HypercertClient | null = null
let hypercertClientAccount: string | null = null
let hypercertClientChainId: number | null = null

/**
 * Get or create Hypercert client instance
 * Uses wagmi walletClient
 */
export async function getHypercertClient(): Promise<HypercertClient> {
  const activeConfig = getConfig()

  // Some connector flows can transiently report `isConnected=false` even when
  // a walletClient is already available; resolve address from either source.
  const account = getAccount(activeConfig)
  const walletClient = await getWalletClient(activeConfig)
  const resolvedAddress = walletClient?.account?.address ?? account.address

  const chainId = walletClient?.chain?.id ?? account.chainId ?? REQUIRED_CHAIN_ID

  // Return existing client only when still bound to the same account+chain.
  if (!resolvedAddress) {
    throw new Error('Wallet not connected. Please connect your wallet first.')
  }
  const normalizedAddress = resolvedAddress.toLowerCase()
  if (
    hypercertClient &&
    hypercertClientAccount === normalizedAddress &&
    hypercertClientChainId === chainId
  ) {
    return hypercertClient
  }

  if (!walletClient) {
    throw new Error('Wallet client not available. Please connect your wallet and ensure it is unlocked.')
  }
  
  // Verify wallet client has an account
  if (!walletClient.account) {
    throw new Error('Wallet account not available. Please ensure your wallet is unlocked and connected.')
  }

  // Initialize Hypercert client
  // The SDK default test deployments do not include Celo Sepolia (11142220),
  // so we provide an explicit deployment map for this app's chain.
  const environment = chainId === 42220 ? 'production' : 'test'
  const publicClient = getPublicClient(activeConfig, { chainId }) ?? undefined

  hypercertClient = new HypercertClient({
    walletClient: walletClient as any, // SDK accepts viem walletClient
    publicClient: publicClient as any,
    environment,
    readOnly: false,
    deployments: {
      decleanup: {
        chainId: chainId as any,
        isTestnet: environment === 'test',
        addresses: {
          HypercertMinterUUPS: HYPERCERTS_CONFIG.contract.address,
        },
      },
    } as any,
  } as any)
  hypercertClientAccount = normalizedAddress
  hypercertClientChainId = chainId

  return hypercertClient
}

/**
 * Reset client (useful for testing or wallet changes)
 */
export function resetHypercertClient() {
  hypercertClient = null
  hypercertClientAccount = null
  hypercertClientChainId = null
}

export { TransferRestrictions }
