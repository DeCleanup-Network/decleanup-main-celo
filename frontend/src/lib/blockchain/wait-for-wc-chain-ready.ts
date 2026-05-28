/**
 * After switchChain on iOS WalletConnect, the connector needs time to register Celo
 * before eth_sendTransaction / writeContract or the tx prompt is lost.
 */

import type { Config } from 'wagmi'
import { getAccount, getChainId, reconnect } from '@wagmi/core'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { waitForUserReturnFromWallet } from '@/lib/blockchain/wait-for-wallet-return'
import { isMobileBrowser } from '@/lib/blockchain/wallet-provider-write'

function settleDelayMs(): number {
  return isMobileBrowser() ? 500 : 150
}

/** Wait for wagmi + WalletConnect to report REQUIRED_CHAIN_ID after a switch. */
export async function waitForWalletConnectChainReady(
  config: Config,
  options?: { skipVisibilityWait?: boolean; maxMs?: number }
): Promise<boolean> {
  if (!options?.skipVisibilityWait) {
    await waitForUserReturnFromWallet(options?.maxMs ?? 90_000)
  }

  await new Promise((r) => setTimeout(r, settleDelayMs()))
  await reconnect(config).catch(() => {})

  const deadline = Date.now() + (options?.maxMs ?? 8_000)
  while (Date.now() < deadline) {
    let chainId = getAccount(config).chainId
    if (chainId == null) {
      try {
        chainId = await getChainId(config)
      } catch {
        /* ignore */
      }
    }
    if (chainId === REQUIRED_CHAIN_ID) {
      await new Promise((r) => setTimeout(r, isMobileBrowser() ? 100 : 0))
      return true
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  return getAccount(config).chainId === REQUIRED_CHAIN_ID
}
