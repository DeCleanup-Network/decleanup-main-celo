/**
 * Send txs through the connected wallet provider (MetaMask / WalletConnect).
 * wagmi/core writeContract often never prompts on mobile Safari; viem walletClient does.
 */

import type { Config } from 'wagmi'
import type { Address, Hex, WalletClient } from 'viem'
import { getAccount, getWalletClient, reconnect } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { requiredViemChain } from '@/lib/blockchain/required-chain'

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** True when MetaMask injected provider is present (extension or in-app browser). */
export function hasMetaMaskProvider(): boolean {
  if (typeof window === 'undefined') return false
  const eth = (window as Window & { ethereum?: { isMetaMask?: boolean } }).ethereum
  return Boolean(eth?.isMetaMask)
}

/**
 * Mobile Safari + “connected” via stale session often cannot sign.
 * WalletConnect or MetaMask in-app browser is required.
 */
export function mobileWalletNeedsWalletConnectHint(): boolean {
  return isMobileBrowser() && !hasMetaMaskProvider()
}

export async function readProviderChainId(client: WalletClient): Promise<number | null> {
  try {
    const hex = await client.request({ method: 'eth_chainId' })
    return parseInt(String(hex), 16)
  } catch {
    return null
  }
}

export async function getConnectedWalletClient(config: Config): Promise<WalletClient> {
  let client =
    (await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })) ??
    (await getWalletClient(config))

  if (!client) {
    try {
      await reconnect(config)
    } catch {
      /* ignore */
    }
    client =
      (await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })) ??
      (await getWalletClient(config))
  }

  if (!client?.account) {
    throw new Error('Wallet not connected. Connect MetaMask or use WalletConnect, then try again.')
  }

  return client
}

const SWITCH_POLL_MS = 60_000

/** Switch network via the wallet provider (works when wagmi switchChain stalls on mobile). */
export async function ensureProviderOnRequiredChain(config: Config): Promise<WalletClient> {
  const client = await getConnectedWalletClient(config)
  const current = await readProviderChainId(client)
  if (current === REQUIRED_CHAIN_ID) return client

  const request = client.request.bind(client) as (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>

  const hexChainId = `0x${REQUIRED_CHAIN_ID.toString(16)}` as Hex

  try {
    await request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    })
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    if (code !== 4902) throw e
    await request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: hexChainId,
          chainName: REQUIRED_CHAIN_NAME,
          rpcUrls: [requiredViemChain.rpcUrls.default.http[0]],
          nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
        },
      ],
    })
    await request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    })
  }

  const deadline = Date.now() + SWITCH_POLL_MS
  while (Date.now() < deadline) {
    const fresh = await getConnectedWalletClient(config)
    const id = await readProviderChainId(fresh)
    if (id === REQUIRED_CHAIN_ID) {
      await reconnect(config).catch(() => {})
      return fresh
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  throw new Error(
    `Could not switch to ${REQUIRED_CHAIN_NAME}. Open MetaMask, select that network, return to this tab, and tap Claim again.`
  )
}

export async function writeContractViaWalletProvider(
  config: Config,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  }
): Promise<Hex> {
  if (mobileWalletNeedsWalletConnectHint()) {
    throw new Error(
      'On mobile, open this site in the MetaMask app browser, or sign in with WalletConnect (Connect wallet on the login page). Safari/Chrome alone cannot sign transactions.'
    )
  }

  const client = await ensureProviderOnRequiredChain(config)
  const account = getAccount(config)
  const from = client.account?.address ?? account.address
  if (!from) {
    throw new Error('Wallet account unavailable. Reconnect your wallet and try again.')
  }

  const hash = await client.writeContract({
    chain: requiredViemChain,
    account: from,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  } as Parameters<WalletClient['writeContract']>[0])

  return hash
}
