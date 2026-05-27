/**
 * Switch external wallet (MetaMask, WalletConnect / Rainbow, Zerion) to the app chain.
 * Shared by network banner, login, and airdrop claim.
 */

import type { Config } from 'wagmi'
import type { Hex } from 'viem'
import { getAccount, getWalletClient, reconnect, switchChain } from '@wagmi/core'
import {
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

const NATIVE = { name: 'CELO', symbol: 'CELO', decimals: 18 }

function hexChainId(): Hex {
  return `0x${REQUIRED_CHAIN_ID.toString(16)}` as Hex
}

async function providerSwitch(config: Config): Promise<void> {
  const client =
    (await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })) ??
    (await getWalletClient(config))
  if (!client?.request) {
    throw new Error('Wallet provider unavailable')
  }

  const request = client.request.bind(client) as (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>

  const chainIdHex = hexChainId()

  try {
    await request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
    return
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    if (code !== 4902) throw e
  }

  await request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: chainIdHex,
        chainName: REQUIRED_CHAIN_NAME,
        rpcUrls: [REQUIRED_RPC_URL],
        blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL].filter(Boolean),
        nativeCurrency: NATIVE,
      },
    ],
  })
  await request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdHex }],
  })
}

/**
 * Prompt wallet to switch to REQUIRED_CHAIN_ID. Returns true if wagmi reports correct chain
 * or switch was sent (WalletConnect may lag updating chainId — tx still includes chain).
 */
export async function switchToRequiredChain(config: Config): Promise<boolean> {
  const account = getAccount(config)
  if (!account.isConnected) return false
  if (account.chainId === REQUIRED_CHAIN_ID) return true

  try {
    await switchChain(config, { chainId: REQUIRED_CHAIN_ID })
  } catch {
    try {
      await providerSwitch(config)
    } catch (e) {
      console.warn('[switchToRequiredChain] failed:', e)
      return false
    }
  }

  await reconnect(config).catch(() => {})
  return getAccount(config).chainId === REQUIRED_CHAIN_ID
}
