/**
 * Switch the connected external wallet to the app's target Celo network.
 */

import { getAccount } from '@wagmi/core'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import { getConnectedWalletClient, trySwitchToRequiredChain } from '@/lib/blockchain/wallet-provider-write'

export function isOnRequiredChain(): boolean {
  try {
    const account = getAccount(getConfig())
    return account.isConnected && account.chainId === REQUIRED_CHAIN_ID
  } catch {
    return false
  }
}

/** Best-effort switch for network banner — does not block on eth_chainId polling. */
export async function ensureRequiredChain(): Promise<void> {
  const config = getConfig()
  const account = getAccount(config)
  if (!account.isConnected) return
  if (account.chainId === REQUIRED_CHAIN_ID) return

  const client = await getConnectedWalletClient(config)
  await trySwitchToRequiredChain(config, client)
}
