/**
 * Stats for people listed as contributors on others' impact reports.
 * Matches wallet, smart account, email, and ENS-as-written.
 */
import type { Address } from 'viem'
import { getImpactIndex } from './indexer'
import {
  addressSet,
  contributorFieldMatches,
  type ContributorIdentity,
} from './contributor-match'

export type { ContributorIdentity }
export { contributorFieldMatches }

function asIdentity(identity: Address | ContributorIdentity): ContributorIdentity {
  if (typeof identity === 'string') return { addresses: [identity] }
  return identity
}

export type ContributorMentionStats = {
  /** Verified cleanups (with impact form) where this person was listed, excluding own submissions */
  contributorCleanupCount: number
  /** Same count: each such cleanup counts as one "impact report filled" for attribution */
  impactReportsAttributed: number
}

export async function getContributorMentionStats(
  identity: Address | ContributorIdentity
): Promise<ContributorMentionStats> {
  const id = asIdentity(identity)
  const mine = addressSet(id.addresses)
  const entries = await getImpactIndex()
  let n = 0
  for (const e of entries) {
    const sub = e.submitter ? String(e.submitter).trim().toLowerCase() : ''
    if (!sub || sub === '0x0000000000000000000000000000000000000000') continue
    if (mine.has(sub)) continue
    const list = Array.isArray(e.contributors) ? e.contributors : []
    if (list.some((c) => contributorFieldMatches(String(c), id))) n++
  }
  return {
    contributorCleanupCount: n,
    impactReportsAttributed: n,
  }
}
