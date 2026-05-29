/**
 * Send txs through the connected wallet provider (MetaMask, WalletConnect / Rainbow / Zerion).
 * Uses @wagmi/core writeContract so the connector client is resolved at call time (not stale).
 * All writes go through the global wallet-write-mutex to prevent WC queue collisions on iOS.
 */

import type { Config } from 'wagmi'
import type { Address, Hex } from 'viem'
import { getAccount, reconnect } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { requiredViemChain } from '@/lib/blockchain/required-chain'
import {
  lockedSwitchToRequiredChain,
  lockedWriteContractRaw,
} from '@/lib/blockchain/wallet-write-mutex'
import { waitForWalletConnectChainReady } from '@/lib/blockchain/wait-for-wc-chain-ready'

import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

export { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

export function shouldShowMobileWalletConnectHint(wagmiConnected: boolean): boolean {
  return isMobileBrowser() && !wagmiConnected
}

export function needsWalletConnectSettle(config: Config): boolean {
  const account = getAccount(config)
  return account.connector?.id === 'walletConnect' || isMobileBrowser()
}

/**
 * Submit contract write — switch (if needed), settle connector state, then writeContract.
 * Serialized through the global mutex so only one wallet op is in-flight at a time.
 */
export async function writeContractViaWalletProvider(
  config: Config,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
    gas?: bigint
  },
  options?: { skipSwitch?: boolean }
): Promise<Hex> {
  const account = getAccount(config)
  if (!account.isConnected) {
    throw new Error('Wallet not connected.')
  }

  if (!options?.skipSwitch && account.chainId !== REQUIRED_CHAIN_ID) {
    const switched = await lockedSwitchToRequiredChain(config)
    if (!switched) {
      throw new Error(
        `Switch to ${REQUIRED_CHAIN_NAME} in your wallet, return to the browser, then tap Claim again.`
      )
    }
  } else if (needsWalletConnectSettle(config)) {
    const ready = await waitForWalletConnectChainReady(config, { skipVisibilityWait: true })
    if (!ready && getAccount(config).chainId !== REQUIRED_CHAIN_ID) {
      throw new Error(
        `Wallet is not on ${REQUIRED_CHAIN_NAME} yet. Switch in your wallet app, then tap Claim again.`
      )
    }
  } else {
    await reconnect(config).catch(() => {})
  }

  return lockedWriteContractRaw(config, {
    chain: requiredViemChain,
    chainId: REQUIRED_CHAIN_ID,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    ...(params.gas ? { gas: params.gas } : {}),
  } as Parameters<typeof import('@wagmi/core').writeContract>[1])
}
