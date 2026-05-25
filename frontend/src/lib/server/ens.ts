import { createPublicClient, http, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { getEnsAddress, getEnsName } from 'viem/actions'
import { normalize } from 'viem/ens'

function ethereumRpcUrl(): string {
  return (
    process.env.ETHEREUM_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL?.trim() ||
    'https://ethereum.publicnode.com'
  )
}

const ethPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(ethereumRpcUrl()),
})

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

/** Primary ENS name for an address (Ethereum mainnet reverse record). */
export async function resolveAddressToEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    return (await getEnsName(ethPublicClient, { address })) ?? null
  } catch {
    return null
  }
}
