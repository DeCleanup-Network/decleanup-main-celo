import 'server-only'
import type { Address, Hex } from 'viem'
import { createPublicClient, formatEther, http, isAddress } from 'viem'
import { REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { getActiveAaChain } from '@/lib/blockchain/aa-chain'

/** Read-only balance for dashboard (no private keys). */
export async function getSmartAccountBalance(address: Address): Promise<string> {
  const publicClient = createPublicClient({
    chain: getActiveAaChain(),
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
