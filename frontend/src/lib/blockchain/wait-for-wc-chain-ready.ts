/**
 * After switchChain on iOS WalletConnect, the connector needs time to register Celo
 * before eth_sendTransaction / writeContract or the tx prompt is lost.
 */

import type { Config } from 'wagmi'
import { getAccount, getChainId, reconnect } from '@wagmi/core'
import { resolveActiveChainId } from '@/lib/blockchain/aa-chain'
import { waitForUserReturnFromWallet } from '@/lib/blockchain/wait-for-wallet-return'
import { isMobileBrowser } from '@/lib/blockchain/wallet-provider-write'

function settleDelayMs(): number {
  return isMobileBrowser() ? 500 : 150
}

/** Wait for wagmi + WalletConnect to report the experience chain after a switch. */
export async function waitForWalletConnectChainReady(
  config: Config,
  options?: { skipVisibilityWait?: boolean; maxMs?: number; chainId?: number }
): Promise<boolean> {
  const targetChainId = options?.chainId ?? resolveActiveChainId()
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
    if (chainId === targetChainId) {
      await new Promise((r) => setTimeout(r, isMobileBrowser() ? 100 : 0))
      return true
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  return getAccount(config).chainId === targetChainId
}
