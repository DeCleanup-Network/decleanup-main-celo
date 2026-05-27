/**
 * Send txs through the connected wallet provider (MetaMask, WalletConnect / Rainbow / Zerion).
 */

import type { Config } from 'wagmi'
import type { Address, Hex, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { getAccount, getWalletClient, reconnect } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { requiredViemChain } from '@/lib/blockchain/required-chain'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'

function chainIdHex(): Hex {
  return `0x${REQUIRED_CHAIN_ID.toString(16)}` as Hex
}

function shouldUseProviderSendTransaction(config: Config): boolean {
  const account = getAccount(config)
  return account.connector?.id === 'walletConnect' || isMobileBrowser()
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function shouldShowMobileWalletConnectHint(wagmiConnected: boolean): boolean {
  return isMobileBrowser() && !wagmiConnected
}

export async function getConnectedWalletClient(config: Config): Promise<WalletClient> {
  let client =
    (await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })) ??
    (await getWalletClient(config))

  if (!client) {
    await reconnect(config).catch(() => {})
    client =
      (await getWalletClient(config, { chainId: REQUIRED_CHAIN_ID })) ??
      (await getWalletClient(config))
  }

  if (!client?.account) {
    throw new Error(
      'Wallet not connected. Connect via WalletConnect on the login page, then return here.'
    )
  }

  return client
}

async function sendContractTx(
  client: WalletClient,
  from: Address,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  },
  config: Config
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  })

  // WalletConnect on mobile: viem writeContract often does not surface a tx prompt after a chain switch.
  if (shouldUseProviderSendTransaction(config) && client.request) {
    const hash = await client.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from,
          to: params.address,
          data,
          value: '0x0',
          chainId: chainIdHex(),
        },
      ],
    })
    return hash as Hex
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
    return await client.sendTransaction({
      chain: requiredViemChain,
      account: from,
      to: params.address,
      data,
      value: 0n,
    })
  }
}

export async function writeContractViaWalletProvider(
  config: Config,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  },
  options?: { skipSwitch?: boolean }
): Promise<Hex> {
  const account = getAccount(config)
  if (!account.isConnected) {
    throw new Error('Wallet not connected.')
  }

  if (!options?.skipSwitch && account.chainId !== REQUIRED_CHAIN_ID) {
    const switched = await switchToRequiredChain(config)
    if (!switched && getAccount(config).chainId !== REQUIRED_CHAIN_ID) {
      throw new Error(
        `Switch to ${REQUIRED_CHAIN_NAME} in your wallet (Rainbow / Zerion / MetaMask), then tap Claim again.`
      )
    }
  }

  await reconnect(config).catch(() => {})

  const client = await getConnectedWalletClient(config)
  const from = (client.account?.address ?? account.address) as Address | undefined
  if (!from) {
    throw new Error('Wallet account unavailable. Reconnect and try again.')
  }

  return sendContractTx(client, from, params, config)
}
