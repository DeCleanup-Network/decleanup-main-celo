/**
 * Switch the connected external wallet (MetaMask / WalletConnect) to the app's target Celo network.
 */

import { getAccount } from '@wagmi/core'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import {
  ensureProviderOnRequiredChain,
  readProviderChainId,
  getConnectedWalletClient,
} from '@/lib/blockchain/wallet-provider-write'

export function isOnRequiredChain(): boolean {
  try {
    const account = getAccount(getConfig())
    return account.isConnected && account.chainId === REQUIRED_CHAIN_ID
  } catch {
    return false
  }
}

/** Ensures wallet provider is on REQUIRED_CHAIN_ID (provider RPC, not wagmi state alone). */
export async function ensureRequiredChain(): Promise<void> {
  const config = getConfig()
  const account = getAccount(config)
  if (!account.isConnected) return

  const client = await getConnectedWalletClient(config)
  const providerChain = await readProviderChainId(client)
  if (providerChain === REQUIRED_CHAIN_ID && account.chainId === REQUIRED_CHAIN_ID) return

  await ensureProviderOnRequiredChain(config)
}
