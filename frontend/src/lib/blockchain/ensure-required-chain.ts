/**
 * Switch the connected external wallet (MetaMask / WalletConnect) to the app's target Celo network.
 * Embedded smart-account users do not use this path.
 */

import { getAccount, getWalletClient, switchChain } from '@wagmi/core'
import {
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_ID_HEX,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'

const NATIVE_SYMBOL = 'CELO'

async function providerSwitch(walletClient: Awaited<ReturnType<typeof getWalletClient>>): Promise<void> {
  if (!walletClient?.request) return
  const request = walletClient.request.bind(walletClient) as (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>

  try {
    await request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: REQUIRED_CHAIN_ID_HEX }],
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
        chainId: REQUIRED_CHAIN_ID_HEX,
        chainName: REQUIRED_CHAIN_NAME,
        rpcUrls: [REQUIRED_RPC_URL],
        blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL].filter(Boolean),
        nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
      },
    ],
  })
  await request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: REQUIRED_CHAIN_ID_HEX }],
  })
}

/**
 * Ensures MetaMask / WC is on REQUIRED_CHAIN_ID. No-op if not connected or already correct.
 */
export async function ensureRequiredChain(): Promise<void> {
  const config = getConfig()
  const account = getAccount(config)
  if (!account.isConnected) return
  if (account.chainId === REQUIRED_CHAIN_ID) return

  try {
    await switchChain(config, { chainId: REQUIRED_CHAIN_ID })
  } catch (wagmiError) {
    const walletClient = await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })
    if (walletClient) {
      try {
        await providerSwitch(walletClient)
      } catch {
        throw wagmiError
      }
    } else {
      throw wagmiError
    }
  }

  const after = getAccount(config)
  if (after.chainId !== REQUIRED_CHAIN_ID) {
    throw new Error(
      `Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID ${REQUIRED_CHAIN_ID}) in your wallet, then try again.`
    )
  }
}
