/**
 * Send txs through the connected wallet provider (MetaMask, WalletConnect).
 * Do not block on chain-id polling before the tx — mobile MetaMask often never
 * updates eth_chainId while the user is already on the right network.
 */

import type { Config } from 'wagmi'
import type { Address, Hex, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { getAccount, getWalletClient, reconnect, switchChain } from '@wagmi/core'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { requiredViemChain } from '@/lib/blockchain/required-chain'

const SWITCH_ATTEMPT_MS = 8_000

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

function isChainMismatchError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: number })?.code
  return (
    code === 4902 ||
    /chain|network|wrong network|does not match/i.test(msg)
  )
}

/** One quick switch attempt — never poll eth_chainId for tens of seconds. */
export async function trySwitchToRequiredChain(config: Config, client: WalletClient): Promise<void> {
  const hexChainId = `0x${REQUIRED_CHAIN_ID.toString(16)}` as Hex
  const request = client.request.bind(client) as (args: {
    method: string
    params?: unknown[]
  }) => Promise<unknown>

  const switchOnce = async () => {
    try {
      await Promise.race([
        switchChain(config, { chainId: REQUIRED_CHAIN_ID }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('switch timeout')), SWITCH_ATTEMPT_MS)
        ),
      ])
      return
    } catch {
      /* wagmi switch failed — try provider */
    }

    try {
      await Promise.race([
        request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('switch timeout')), SWITCH_ATTEMPT_MS)
        ),
      ])
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code
      if (code === 4902) {
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
    }
  }

  await switchOnce().catch(() => {
    /* User may already be on Celo in MetaMask — proceed to tx and let the wallet prompt. */
  })
}

async function sendContractTx(
  client: WalletClient,
  from: Address,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  }
): Promise<Hex> {
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

/**
 * Submit contract call — prompts wallet immediately; optional switch only on chain errors.
 */
export async function writeContractViaWalletProvider(
  config: Config,
  params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
  }
): Promise<Hex> {
  let client = await getConnectedWalletClient(config)
  const account = getAccount(config)
  const from = (client.account?.address ?? account.address) as Address | undefined
  if (!from) {
    throw new Error('Wallet account unavailable. Reconnect your wallet and try again.')
  }

  // If wagmi already reports the target chain, send tx now (no switch dance).
  if (account.chainId === REQUIRED_CHAIN_ID) {
    try {
      return await sendContractTx(client, from, params)
    } catch (e) {
      if (!isChainMismatchError(e)) throw e
    }
  }

  // Wrong or unknown chain: one short switch attempt, then tx (wallet shows confirm).
  await trySwitchToRequiredChain(config, client)
  client = await getConnectedWalletClient(config)

  try {
    return await sendContractTx(client, from, params)
  } catch (e) {
    if (isChainMismatchError(e)) {
      throw new Error(
        `Could not submit on ${REQUIRED_CHAIN_NAME}. In MetaMask, pick Celo for this transaction, then tap Claim again.`
      )
    }
    throw e
  }
}
