import 'server-only'
import type { Address, PublicClient } from 'viem'
import { getAddress } from 'viem'

/** Minimal Gnosis Safe `isOwner(address)` (1.3.x). */
const SAFE_IS_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

async function safeIsOwner(
  client: PublicClient,
  safeLike: Address,
  ownerCandidate: Address
): Promise<boolean> {
  try {
    return await client.readContract({
      address: safeLike,
      abi: SAFE_IS_OWNER_ABI,
      functionName: 'isOwner',
      args: [ownerCandidate],
    })
  } catch {
    return false
  }
}

/**
 * Allows saving a profile row for `portfolio` when the signature is from `signer` and either:
 * - same address, or
 * - one is a Safe (or Safe-compatible contract) that lists the other as an owner.
 *
 * Covers `/impact/0xEOA?sa=0xSafe` where the message binds the EOA row but the connected wallet is the Safe.
 */
export async function assertSignerMayEditPortfolioProfile(
  client: PublicClient,
  portfolio: Address,
  signer: Address
): Promise<void> {
  const p = getAddress(portfolio)
  const s = getAddress(signer)
  if (p === s) return

  if (await safeIsOwner(client, p, s)) return
  if (await safeIsOwner(client, s, p)) return

  const err = new Error('SIGNER_NOT_AUTHORIZED_FOR_PORTFOLIO')
  ;(err as Error & { status?: number }).status = 403
  throw err
}
