/**
 * Optional ERC-4337 / Pimlico scaffold for gasless txs (not wired into main product flows).
 * The app runs fine with EOAs only; enable only after dependency and ops review.
 *
 * Env: NEXT_PUBLIC_PIMLICO_API_KEY (or PIMLICO_API_KEY). May require `permissionless`.
 */

import type { Account, Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from './chain-constants'

const CELO_SEPOLIA_CHAIN_ID = 11142220

const celoSepolia = {
  id: CELO_SEPOLIA_CHAIN_ID,
  name: 'Celo Sepolia',
  nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://celo-sepolia.blockscout.com' } },
} as const

function getPimlicoUrl(): string | null {
  const apiKey =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? process.env.PIMLICO_API_KEY
      : null
  if (!apiKey) return null
  return `https://api.pimlico.io/v2/celo-sepolia/rpc?apikey=${apiKey}`
}

/**
 * Creates a public client for Celo Sepolia (for reading and for smart account creation).
 */
export function getCeloSepoliaPublicClient() {
  return createPublicClient({
    chain: celoSepolia,
    transport: http(REQUIRED_RPC_URL),
  })
}

/**
 * Returns the Pimlico bundler + paymaster RPC URL for Celo Sepolia, or null if no API key.
 */
export function getPimlicoCeloSepoliaUrl(): string | null {
  return getPimlicoUrl()
}

/**
 * Whether gasless (paymaster) is configured for Celo Sepolia.
 */
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
 * Creates a smart account client for Celo Sepolia with Pimlico bundler + paymaster.
 * Pass the EOA owner (e.g. from Web3Auth; you need to adapt useWalletClient to a viem Account).
 *
 * Requires: npm install permissionless
 * Lazy-loaded so the app still builds if permissionless is not installed.
 */
export async function createSmartAccountClientCeloSepolia(owner: Account): Promise<unknown> {
  const pimlicoUrl = getPimlicoUrl()
  if (!pimlicoUrl) throw new Error('Pimlico API key not set. Add NEXT_PUBLIC_PIMLICO_API_KEY or PIMLICO_API_KEY.')

  const { createSmartAccountClient } = await import('permissionless')
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')
  const entryPoint = { address: entryPoint07Address as `0x${string}`, version: '0.7' as const }

  const publicClient = getCeloSepoliaPublicClient()

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
    chain: celoSepolia,
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
