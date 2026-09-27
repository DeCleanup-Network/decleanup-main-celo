/**
 * Switch external wallet (MetaMask, WalletConnect / Rainbow, Zerion) to the app chain.
 * Shared by network banner, login, and airdrop claim.
 */

import type { Config } from 'wagmi'
import type { Hex } from 'viem'
import { getAccount, getWalletClient, switchChain } from '@wagmi/core'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  CHAIN_CONFIGS,
  REQUIRED_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  type SupportedChainId,
} from '@/lib/blockchain/chain-constants'
import { isSupportedChainId, resolveActiveChainId } from '@/lib/blockchain/aa-chain'
import { waitForWalletConnectChainReady } from '@/lib/blockchain/wait-for-wc-chain-ready'

function nativeCurrencyFor(chainId: number) {
  if (
    chainId === ROBINHOOD_TESTNET_CHAIN_ID ||
    chainId === BASE_MAINNET_CHAIN_ID ||
    chainId === BASE_SEPOLIA_CHAIN_ID
  ) {
    return { name: 'ETH', symbol: 'ETH', decimals: 18 }
  }
  return { name: 'CELO', symbol: 'CELO', decimals: 18 }
}

function addChainParams(chainId: SupportedChainId) {
  const config = CHAIN_CONFIGS[chainId]
  return {
    chainId: `0x${chainId.toString(16)}` as Hex,
    chainName: config.name,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.blockExplorerUrl].filter(Boolean),
    nativeCurrency: nativeCurrencyFor(chainId),
  }
}

async function providerSwitch(config: Config, chainId: SupportedChainId): Promise<void> {
  const client =
    (await getWalletClient(config, { chainId })) ?? (await getWalletClient(config))
  if (!client?.request) {
    throw new Error('Wallet provider unavailable')
  }

  const request = client.request.bind(client) as (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>

  const params = addChainParams(chainId)

  try {
    await request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }],
    })
    return
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    const message = String((e as { message?: string })?.message ?? e)
    // 4902 = chain not in wallet. MetaMask also throws "Unrecognized chain ID".
    if (code !== 4902 && !/unrecognized chain id/i.test(message)) throw e
  }

  await request({
    method: 'wallet_addEthereumChain',
    params: [params],
  })
  await request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: params.chainId }],
  })
}

function resolveTargetChainId(explicit?: number): SupportedChainId {
  const id = explicit ?? resolveActiveChainId()
  return isSupportedChainId(id) ? id : REQUIRED_CHAIN_ID
}

/**
 * Switch the connected wallet to an experience chain, adding it if MetaMask
 * does not know the chain id yet (Robinhood testnet 0xb626).
 */
export async function switchToExperienceChain(
  config: Config,
  chainId?: number
): Promise<boolean> {
  const targetChainId = resolveTargetChainId(chainId)
  const account = getAccount(config)
  if (process.env.NODE_ENV === 'development') {
    console.log('[switchToExperienceChain] start', {
      isConnected: account.isConnected,
      chainId: account.chainId,
      targetChainId,
      connectorId: account.connector?.id,
      connectorName: account.connector?.name,
    })
  }
  if (!account.isConnected) return false

  if (account.chainId === targetChainId) {
    return true
  }

  try {
    await switchChain(config, { chainId: targetChainId })
  } catch {
    try {
      await providerSwitch(config, targetChainId)
    } catch (e) {
      console.warn('[switchToExperienceChain] failed:', e)
      return false
    }
  }

  return waitForWalletConnectChainReady(config, {
    skipVisibilityWait: true,
    chainId: targetChainId,
  })
}

/** Await switch to the live picker chain (localStorage, else env). */
export async function switchToRequiredChain(config: Config): Promise<boolean> {
  return switchToExperienceChain(config)
}
