import type { Address } from 'viem'

/** Resolve legacy smart-account referral URLs to canonical EOA public identity. */
export async function normalizeReferrerAddress(ref: Address): Promise<Address> {
  try {
    const res = await fetch(`/api/wallet/resolve-identity?address=${encodeURIComponent(ref)}`, {
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (data?.success && typeof data.publicAddress === 'string') {
      return data.publicAddress as Address
    }
  } catch {
    // fall through to raw ref
  }
  return ref
}
