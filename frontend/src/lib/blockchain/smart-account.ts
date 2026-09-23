/**
 * ERC-4337 / Pimlico paymaster client for the active chain (Celo or Base).
 *
 * Env: NEXT_PUBLIC_PIMLICO_API_KEY (or PIMLICO_API_KEY).
 * Enable each chain on the Pimlico sponsorship policy before sending UserOps there.
 */

import type { Account, Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { REQUIRED_RPC_URL } from './chain-constants'
import { getActiveAaChain, getPimlicoBundlerUrl } from './aa-chain'

function getPimlicoUrl(): string | null {
  const apiKey =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? process.env.PIMLICO_API_KEY
      : null
  if (!apiKey) return null
  return getPimlicoBundlerUrl(apiKey)
}

/**
 * Public client for the active chain (used for reading and for smart account creation).
 */
export function getActiveChainPublicClient() {
  return createPublicClient({
    chain: getActiveAaChain(),
    transport: http(REQUIRED_RPC_URL),
  })
}

/** Backwards-compatible alias for the old (Sepolia-only) name. */
export const getCeloSepoliaPublicClient = getActiveChainPublicClient

/**
 * Pimlico bundler + paymaster RPC URL for the active chain (mainnet or sepolia).
 * Returns null when no API key is set.
 */
export function getPimlicoActiveChainUrl(): string | null {
  return getPimlicoUrl()
}

/** Backwards-compatible alias for the old (Sepolia-only) name. */
export const getPimlicoCeloSepoliaUrl = getPimlicoActiveChainUrl

/** Whether gasless (paymaster) is configured for the active chain. */
export function isPaymasterConfigured(): boolean {
  return getPimlicoUrl() != null
}

/** Counterfactual / deployed smart account address from a permissionless client instance. */
export function getSmartAccountAddressFromClient(client: unknown): Address | null {
  if (!client || typeof client !== 'object') return null
  const addr = (client as { account?: { address?: unknown } }).account?.address
  if (typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr)) return addr as Address
  return null
}

/**
 * Creates a smart account client for the active chain (Celo or Base)
 * with Pimlico bundler + paymaster.
 *
 * Pass the EOA owner (e.g. from Web3Auth via walletClientToAccount).
 */
export async function createSmartAccountClientForActiveChain(owner: Account): Promise<unknown> {
  const pimlicoUrl = getPimlicoUrl()
  if (!pimlicoUrl) throw new Error('Pimlico API key not set. Add NEXT_PUBLIC_PIMLICO_API_KEY or PIMLICO_API_KEY.')

  const { createSmartAccountClient } = await import('permissionless')
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')
  const entryPoint = { address: entryPoint07Address as `0x${string}`, version: '0.7' as const }

  const activeChain = getActiveAaChain()
  const publicClient = getActiveChainPublicClient()

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    entryPoint,
    version: '1.4.1',
  })

  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint,
  })

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: activeChain,
    bundlerTransport: http(pimlicoUrl),
    // Pimlico endpoint supports both bundler and paymaster RPC methods.
    // `paymaster: true` enables sponsored UserOps via that endpoint.
    paymaster: true,
    userOperation: {
      // Pimlico requires EIP-1559 fee fields to be present before paymaster stub sponsorship.
      estimateFeesPerGas: async () => {
        const gas = await pimlicoClient.getUserOperationGasPrice()
        return gas.fast
      },
    },
  })

  // Expose sendTransaction in the shape expected by GaslessClient (contracts.ts)
  return {
    ...smartAccountClient,
    sendTransaction: (params: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }) =>
      smartAccountClient.sendTransaction({
        to: params.to,
        value: params.value ?? 0n,
        data: params.data ?? '0x',
      }),
  }
}

/** Backwards-compatible alias for the old (Sepolia-only) name. */
export const createSmartAccountClientCeloSepolia = createSmartAccountClientForActiveChain
