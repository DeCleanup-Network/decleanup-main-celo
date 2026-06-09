import { createPublicClient, http, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { getEnsAddress, getEnsName, getEnsText } from 'viem/actions'
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

const PORTFOLIO_ENS_TEXT_KEYS = ['url', 'description', 'com.twitter', 'org.farcaster', 'location'] as const

/** Public ENS text records used for portfolio identity disclosure. */
export async function resolveEnsTextRecords(
  ensName: string
): Promise<Record<string, string>> {
  const name = normalize(ensName.trim())
  const out: Record<string, string> = {}
  await Promise.all(
    PORTFOLIO_ENS_TEXT_KEYS.map(async (key) => {
      try {
        const value = await getEnsText(ethPublicClient, { name, key })
        if (value?.trim()) out[key] = value.trim()
      } catch {
        // skip missing keys
      }
    })
  )
  return out
}
