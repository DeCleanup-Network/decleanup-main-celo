/**
 * Send txs through the connected wallet provider (MetaMask, WalletConnect / Rainbow / Zerion).
 * Uses @wagmi/core writeContract so the connector client is resolved at call time (not stale).
 */

import type { Config } from 'wagmi'
import type { Address, Hex } from 'viem'
import { getAccount, reconnect, writeContract } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'
import { waitForWalletConnectChainReady } from '@/lib/blockchain/wait-for-wc-chain-ready'

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function shouldShowMobileWalletConnectHint(wagmiConnected: boolean): boolean {
  return isMobileBrowser() && !wagmiConnected
}

export function needsWalletConnectSettle(config: Config): boolean {
  const account = getAccount(config)
  return account.connector?.id === 'walletConnect' || isMobileBrowser()
}

/**
 * Submit contract write — switch (if needed), settle connector state, then writeContract (awaited).
 */
export async function writeContractViaWalletProvider(
  config: Config,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  },
  options?: { skipSwitch?: boolean; skipSettle?: boolean }
): Promise<Hex> {
  const account = getAccount(config)
  if (!account.isConnected) {
    throw new Error('Wallet not connected.')
  }

  if (!options?.skipSwitch && account.chainId !== REQUIRED_CHAIN_ID) {
    const switched = await switchToRequiredChain(config)
    if (!switched) {
      throw new Error(
        `Switch to ${REQUIRED_CHAIN_NAME} in your wallet, return to the browser, then tap Claim again.`
      )
    }
  } else if (needsWalletConnectSettle(config) && !options?.skipSettle) {
    const ready = await waitForWalletConnectChainReady(config, { skipVisibilityWait: true })
    if (!ready && getAccount(config).chainId !== REQUIRED_CHAIN_ID) {
      throw new Error(
        `Wallet is not on ${REQUIRED_CHAIN_NAME} yet. Switch in your wallet app, then tap Claim again.`
      )
    }
  } else {
    await reconnect(config).catch(() => {})
  }

  const hash = await writeContract(config, {
    chainId: REQUIRED_CHAIN_ID,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  } as Parameters<typeof writeContract>[1])

  return hash
}
