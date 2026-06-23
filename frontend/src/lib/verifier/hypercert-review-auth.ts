import 'server-only'
import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { isVerifierAddressOnChain } from '@/lib/server/is-verifier-address'

/** Submission admins or on-chain verifiers may approve/reject Hypercert requests. */
export async function canReviewHypercertOnChain(address: string): Promise<boolean> {
  if (!address) return false
  const [admin, verifier] = await Promise.all([
    isAdminOnChain(address),
    isVerifierAddressOnChain(address),
  ])
  return admin || verifier
}
