/**
 * Server-only: binds a $cDCU claim to the owner of the reward points.
 *
 * `source` (whose DCU points are counted) and `recipient` (who receives the mint) come from the
 * request body, so neither proves anything by itself. A signature is only issued when the payout
 * goes to the reward identity's own EOA or its canonical single-owner Safe (derived from the EOA,
 * not from DB rows, which a signed-in user can write for arbitrary addresses).
 */

import 'server-only'
import { type Address, getAddress } from 'viem'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'
import { predictSafeAddressFromOwnerAddress } from '@/lib/wallet/predict-safe-from-address'

export type ClaimIdentity = {
  /** Address whose reward points and tranche accounting are used. */
  rewardIdentity: Address
  /** Optional smart account whose points are merged into `rewardIdentity`. */
  linkedAccount?: Address
  /** Lowercased addresses allowed to receive the mint for this identity. */
  allowedRecipients: Set<string>
}

export async function resolveClaimIdentity(source: string): Promise<ClaimIdentity> {
  const identity = await resolveWalletIdentity(source)
  const rewardIdentity = getAddress(identity?.publicAddress ?? source) as Address
  const linkedAccount =
    identity?.smartAccountAddress &&
    identity.smartAccountAddress.toLowerCase() !== rewardIdentity.toLowerCase()
      ? identity.smartAccountAddress
      : undefined

  const allowedRecipients = new Set<string>([rewardIdentity.toLowerCase()])
  try {
    const canonicalSafe = await predictSafeAddressFromOwnerAddress(rewardIdentity)
    allowedRecipients.add(canonicalSafe.toLowerCase())
  } catch (e) {
    console.warn('[cdcu claim-auth] Safe prediction failed; only the EOA may receive:', e)
  }

  return { rewardIdentity, linkedAccount, allowedRecipients }
}

export function isAllowedRecipient(identity: ClaimIdentity, recipient: string): boolean {
  return identity.allowedRecipients.has(recipient.toLowerCase())
}
