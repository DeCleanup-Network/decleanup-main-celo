'use client'

import { createPublicClient, http, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { getEnsAddress, getEnsName } from 'viem/actions'
import { normalize } from 'viem/ens'

const ethPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com'
  ),
})

/**
 * Resolve an ENS name or return the address if already a valid address.
 * ENS resolution runs on Ethereum mainnet.
 * @returns Resolved address (checksummed) or null if invalid/unresolvable
 */
export async function resolveEnsToAddress(ensOrAddress: string): Promise<string | null> {
  const trimmed = ensOrAddress.trim()
  if (!trimmed) return null

  if (isAddress(trimmed)) return trimmed

  try {
    const name = normalize(trimmed)
    const resolved = await getEnsAddress(ethPublicClient, { name })
    return resolved ?? null
  } catch {
    return null
  }
}

/**
 * Primary ENS name for an address (Ethereum mainnet), if set.
 */
export async function resolveAddressToEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    return (await getEnsName(ethPublicClient, { address })) ?? null
  } catch {
    return null
  }
}
