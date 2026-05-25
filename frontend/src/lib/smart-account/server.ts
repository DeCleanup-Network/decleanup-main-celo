import 'server-only'
import type { Address, Hex } from 'viem'
import { createPublicClient, formatEther, http, isAddress } from 'viem'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { entryPoint07Address } from 'viem/account-abstraction'

const entryPoint = { address: entryPoint07Address as Address, version: '0.7' as const }

async function getActiveChain() {
  const CELO_MAINNET = 42220
  return {
    id: REQUIRED_CHAIN_ID,
    name: REQUIRED_CHAIN_ID === CELO_MAINNET ? 'Celo' : 'Celo Sepolia',
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  } as const
}

/** Read-only balance for dashboard (no private keys). */
export async function getSmartAccountBalance(address: Address): Promise<string> {
  const publicClient = createPublicClient({
    chain: await getActiveChain(),
    transport: http(REQUIRED_RPC_URL),
  })
  const wei = await publicClient.getBalance({ address })
  return formatEther(wei)
}

/** Optional server-side receipt proxy (read-only). Prefer client-side when unlocked. */
export async function getUserOperationReceipt(userOpHash: Hex) {
  const { getClientUserOperationReceiptSafe } = await import('@/lib/smart-account/wait-user-op')
  return getClientUserOperationReceiptSafe(userOpHash)
}

export function assertAddress(value: string): Address {
  if (!isAddress(value)) throw new Error('Invalid address')
  return value
}
