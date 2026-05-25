import { isAddress } from 'viem'

/**
 * Client-safe ENS helpers — call same-origin API routes (CSP blocks direct Ethereum RPC from browser).
 */

export async function resolveEnsToAddress(ensOrAddress: string): Promise<string | null> {
  const trimmed = ensOrAddress.trim()
  if (!trimmed) return null
  if (isAddress(trimmed)) return trimmed

  try {
    const res = await fetch(`/api/ens/forward?name=${encodeURIComponent(trimmed)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { address: string | null }
    return data.address ?? null
  } catch {
    return null
  }
}

export async function resolveAddressToEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    const res = await fetch(`/api/ens/reverse?address=${encodeURIComponent(address)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { name: string | null }
    return data.name ?? null
  } catch {
    return null
  }
}
