/**
 * Switch the connected external wallet to the app's target Celo network.
 */

import { getAccount } from '@wagmi/core'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'

export function isOnRequiredChain(): boolean {
  try {
    const account = getAccount(getConfig())
    return account.isConnected && account.chainId === REQUIRED_CHAIN_ID
  } catch {
    return false
  }
}

export async function ensureRequiredChain(): Promise<void> {
  const config = getConfig()
  const account = getAccount(config)
  if (!account.isConnected) return
  if (account.chainId === REQUIRED_CHAIN_ID) return
  await switchToRequiredChain(config)
}
