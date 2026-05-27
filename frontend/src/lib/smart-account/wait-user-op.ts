import type { Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'

const entryPoint = { address: entryPoint07Address as `0x${string}`, version: '0.7' as const }

function getChain() {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return {
    id: REQUIRED_CHAIN_ID,
    name: isMainnet ? 'Celo' : 'Celo Sepolia',
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  } as const
}

function getPimlicoUrl(): string {
  const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY?.trim()
  if (!apiKey) throw new Error('NEXT_PUBLIC_PIMLICO_API_KEY is not set')
  const slug = REQUIRED_CHAIN_ID === 42220 ? 'celo' : 'celo-sepolia'
  return `https://api.pimlico.io/v2/${slug}/rpc?apikey=${apiKey}`
}

/** Bundler returns this while the UserOp is still pending — not a hard failure. */
export function isUserOpReceiptPendingError(error: unknown): boolean {
  const msg =
    (error instanceof Error ? error.message : null) ??
    (typeof error === 'object' && error && 'shortMessage' in error
      ? String((error as { shortMessage?: string }).shortMessage)
      : String(error))
  return (
    /could not be found/i.test(msg) ||
    /not have been processed yet/i.test(msg) ||
    /UserOperation not found/i.test(msg) ||
    /Missing UserOperation receipt/i.test(msg)
  )
}

export async function getClientUserOperationReceiptSafe(userOpHash: Hex) {
  const pimlicoUrl = getPimlicoUrl()
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')
  const pimlico = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint,
  })
  try {
    return await pimlico.getUserOperationReceipt({ hash: userOpHash })
  } catch (error) {
    if (isUserOpReceiptPendingError(error)) return null
    throw error
  }
}

export type GaslessConfirmation = {
  transactionHash: Hex
  userOpHash: Hex
}

/**
 * Wait until a gasless send is mined. `hash` is usually the UserOp hash from permissionless;
 * falls back to treating it as an on-chain tx hash if the bundler already returned one.
 */
export async function waitForGaslessUserOperationConfirmation(
  hash: Hex,
  opts?: { timeoutMs?: number; pollMs?: number }
): Promise<GaslessConfirmation> {
  const timeoutMs = opts?.timeoutMs ?? 240_000
  const pollMs = opts?.pollMs ?? 3000
  const deadline = Date.now() + timeoutMs

  const publicClient = createPublicClient({
    chain: getChain(),
    transport: http(REQUIRED_RPC_URL),
  })

  while (Date.now() < deadline) {
    const userOpReceipt = await getClientUserOperationReceiptSafe(hash)
    if (userOpReceipt?.receipt?.transactionHash) {
      if (userOpReceipt.success === false) {
        throw new Error(
          `Gasless transaction failed onchain (UserOp ${hash}). The bundler or paymaster may have rejected it — check Pimlico dashboard and smart-account CELO balance if the action sends native value.`
        )
      }
      return {
        userOpHash: hash,
        transactionHash: userOpReceipt.receipt.transactionHash as Hex,
      }
    }

    try {
      const txReceipt = await publicClient.getTransactionReceipt({ hash })
      if (txReceipt.blockNumber) {
        if (txReceipt.status === 'reverted') {
          throw new Error(`Transaction reverted (${hash}).`)
        }
        return { userOpHash: hash, transactionHash: hash }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !/could not be found/i.test(error.message) &&
        !/not found/i.test(error.message)
      ) {
        throw error
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `Gasless transaction not confirmed after ${Math.round(timeoutMs / 1000)}s (UserOp ${hash}). ` +
      `It may still be processing — wait a minute and refresh, or check the transaction on the block explorer. ` +
      `If this keeps happening, confirm Pimlico supports Celo (chain ${REQUIRED_CHAIN_ID}) and your API key is active.`
  )
}
