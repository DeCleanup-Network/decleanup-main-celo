/**
 * Send txs through the connected wallet provider (MetaMask injected, WalletConnect, etc.).
 * Uses viem walletClient so WalletConnect on mobile Safari can sign (wagmi writeContract often stalls).
 */

import type { Config } from 'wagmi'
import type { Address, Hex, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { getAccount, getWalletClient, reconnect } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { requiredViemChain } from '@/lib/blockchain/required-chain'

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** Show pre-connect hint only — not when WalletConnect / wagmi is already connected. */
export function shouldShowMobileWalletConnectHint(wagmiConnected: boolean): boolean {
  return isMobileBrowser() && !wagmiConnected
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
    throw new Error(
      'Wallet not connected. On phone, use Connect wallet (WalletConnect) on the login page, then return here.'
    )
  }

  return client
}

const SWITCH_POLL_MS = 45_000

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
          blockExplorerUrls: requiredViemChain.blockExplorers?.default?.url
            ? [requiredViemChain.blockExplorers.default.url]
            : [],
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
    `Could not switch to ${REQUIRED_CHAIN_NAME}. Switch network in your wallet, return here, and tap Claim again.`
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
  const client = await ensureProviderOnRequiredChain(config)
  const account = getAccount(config)
  const from = client.account?.address ?? account.address
  if (!from) {
    throw new Error('Wallet account unavailable. Reconnect your wallet and try again.')
  }

  const writeParams = {
    chain: requiredViemChain,
    account: from,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  } as Parameters<WalletClient['writeContract']>[0]

  try {
    return await client.writeContract(writeParams)
  } catch (firstError) {
    console.warn('[wallet-provider-write] writeContract failed, trying sendTransaction:', firstError)
    const data = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    })
    return await client.sendTransaction({
      chain: requiredViemChain,
      account: from,
      to: params.address,
      data,
      value: 0n,
    })
  }
}
