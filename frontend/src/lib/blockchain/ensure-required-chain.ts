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

export function isOnRequiredChain(): boolean {
  try {
    const account = getAccount(getConfig())
    return account.isConnected && account.chainId === REQUIRED_CHAIN_ID
  } catch {
    return false
  }
}

/** Wagmi can lag behind MetaMask after approve — poll briefly (common on mobile). */
async function waitForRequiredChain(maxMs = 20_000): Promise<void> {
  const config = getConfig()
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (getAccount(config).chainId === REQUIRED_CHAIN_ID) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `Still not on ${REQUIRED_CHAIN_NAME}. Open MetaMask, select ${REQUIRED_CHAIN_NAME} (Chain ID ${REQUIRED_CHAIN_ID}), then tap Claim again.`
  )
}

/**
 * Ensures MetaMask / WC is on REQUIRED_CHAIN_ID. No-op if not connected or already correct.
 * First wallet popup is usually the network switch — the claim tx comes after this returns.
 */
export async function ensureRequiredChain(): Promise<void> {
  const config = getConfig()
  const account = getAccount(config)
  if (!account.isConnected) return
  if (account.chainId === REQUIRED_CHAIN_ID) return

  const switchDeadline = Date.now() + 90_000

  try {
    await Promise.race([
      switchChain(config, { chainId: REQUIRED_CHAIN_ID }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Network switch timed out. Approve ${REQUIRED_CHAIN_NAME} in MetaMask or switch manually.`)),
          90_000
        )
      }),
    ])
  } catch (wagmiError) {
    const walletClient = await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })
    if (walletClient && Date.now() < switchDeadline) {
      try {
        await providerSwitch(walletClient)
      } catch {
        throw wagmiError
      }
    } else {
      throw wagmiError
    }
  }

  await waitForRequiredChain(Math.max(5_000, switchDeadline - Date.now()))
}
