import type { VerifierApplication } from '@/lib/verifier/types'

/** Addresses that belong to the current session (smart account + optional EOA). */
export function ownedVerifierWalletTargets(
  smartAccount?: string | null,
  eoa?: string | null
): string[] {
  const set = new Set<string>()
  const sa = smartAccount?.trim().toLowerCase()
  const eo = eoa?.trim().toLowerCase()
  if (sa && /^0x[a-f0-9]{40}$/.test(sa)) set.add(sa)
  if (eo && /^0x[a-f0-9]{40}$/.test(eo) && eo !== sa) set.add(eo)
  return Array.from(set)
}

export function applicationOwnedByWallets(
  app: VerifierApplication,
  owned: ReadonlySet<string>
): boolean {
  return owned.has(app.address.toLowerCase())
}

/**
 * Pick the application row to show for this session. Never returns another wallet's row.
 * Prefers the smart-account address when both EOA and SA have history.
 */
export function pickOwnedVerifierApplication(
  apps: VerifierApplication[],
  preferredAddress?: string | null
): VerifierApplication | null {
  if (!apps.length) return null
  const pref = preferredAddress?.trim().toLowerCase()
  const pool =
    pref && /^0x[a-f0-9]{40}$/.test(pref)
      ? apps.filter((a) => a.address.toLowerCase() === pref)
      : apps
  if (!pool.length) return null

  const sorted = [...pool].sort((a, b) => b.appliedAt - a.appliedAt)
  const newest = sorted[0]

  const rejects = sorted.filter((a) => a.status === 'REJECTED')
  if (!rejects.length) return newest

  const newestRejected = rejects.reduce((a, b) => (a.appliedAt >= b.appliedAt ? a : b))
  const hasNewerQueue = sorted.some(
    (a) =>
      (a.status === 'PENDING' || a.status === 'PENDING_ONCHAIN') &&
      a.appliedAt > newestRejected.appliedAt
  )
  if (hasNewerQueue) return newest
  return newestRejected.appliedAt > newest.appliedAt ? newestRejected : newest
}
