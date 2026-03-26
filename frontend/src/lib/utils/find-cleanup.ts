/**
 * Helper function to find cleanup submissions by wallet address
 * Useful for verifier debugging and admin tools
 */

import { Address } from 'viem'
import { readContract } from 'wagmi/actions'
import { config } from '../blockchain/wagmi'

/* -------------------------------------------------------------------------- */
/*                               CONFIG / ABI                                 */
/* -------------------------------------------------------------------------- */

const VERIFICATION_CONTRACT =
  process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

// Minimal ABI compatible with current MVP contracts.ts
const VERIFICATION_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'rewarded', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
  },
] as const

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type CleanupSearchResult = {
  cleanupId: bigint
  verified: boolean
  claimed: boolean
  level: number
  user: Address
}

/* -------------------------------------------------------------------------- */
/*                              MAIN SEARCH                                   */
/* -------------------------------------------------------------------------- */

/**
 * Find cleanups submitted by a wallet (full or partial address match)
 * NOTE: MVP-safe implementation; does not rely on onchain counters
 */
export async function findCleanupsByWallet(
  walletAddressOrPartial: string,
  maxSearchRange: number = 100
): Promise<CleanupSearchResult[]> {
  if (!VERIFICATION_CONTRACT) {
    throw new Error('VERIFICATION contract address not configured')
  }

  const results: CleanupSearchResult[] = []

  const searchTerm = walletAddressOrPartial
    .trim()
    .toLowerCase()
    .replace(/^0x/, '')

  for (let i = 1; i <= maxSearchRange; i++) {
    try {
      const details: any = await readContract(config, {
        address: VERIFICATION_CONTRACT,
        abi: VERIFICATION_ABI,
        functionName: 'getSubmissionDetails',
        args: [BigInt(i)],
      })

      const user = details.submitter as Address

      if (
        !user ||
        user === '0x0000000000000000000000000000000000000000'
      ) {
        continue
      }

      const userNormalized = user.toLowerCase().replace(/^0x/, '')

      const isMatch =
        searchTerm.length >= 4
          ? userNormalized.includes(searchTerm)
          : userNormalized === searchTerm

      if (!isMatch) continue

      const status = Number(details.status)

      results.push({
        cleanupId: BigInt(i),
        user,
        verified: status === 1,
        claimed: Boolean(details.rewarded),
        level: status === 1 ? 1 : 0, // MVP: single-level approval
      })
    } catch (err: any) {
      // Ignore missing IDs / reverts
      const msg = err?.message || ''
      if (
        !msg.includes('revert') &&
        !msg.includes('does not exist') &&
        !msg.includes('Invalid')
      ) {
        console.warn(`findCleanupsByWallet: error on ID ${i}`, msg)
      }
    }
  }

  return results
}
