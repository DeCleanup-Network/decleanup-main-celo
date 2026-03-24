/**
 * Stats for addresses listed as contributors on others' impact reports.
 * No DCU rewards; attribution / reputation only.
 */
import type { Address } from 'viem'
import { getImpactIndex } from './indexer'

function normAddr(a: string): string {
  const s = String(a).trim().toLowerCase()
  return s.startsWith('0x') && s.length === 42 ? s : s
}

/** True if contributor string refers to the same wallet as `target`. */
function contributorMatches(contributorField: string, target: Address): boolean {
  const t = target.toLowerCase()
  const c = normAddr(contributorField)
  if (c.startsWith('0x') && c.length === 42) return c === t
  // Plain names can't be matched to onchain stats without manual linking
  return false
}

export type ContributorMentionStats = {
  /** Verified cleanups (with impact form) where this address was listed as contributor, excluding own submissions */
  contributorCleanupCount: number
  /** Same count: each such cleanup counts as one "impact report filled" for attribution */
  impactReportsAttributed: number
}

export async function getContributorMentionStats(address: Address): Promise<ContributorMentionStats> {
  const entries = await getImpactIndex()
  const target = address.toLowerCase()
  let n = 0
  for (const e of entries) {
    const sub = e.submitter ? String(e.submitter).toLowerCase() : ''
    if (!sub || sub === '0x0000000000000000000000000000000000000000') continue
    if (sub === target) continue
    const list = Array.isArray(e.contributors) ? e.contributors : []
    const has = list.some((c) => contributorMatches(String(c), address))
    if (has) n++
  }
  return {
    contributorCleanupCount: n,
    impactReportsAttributed: n,
  }
}
