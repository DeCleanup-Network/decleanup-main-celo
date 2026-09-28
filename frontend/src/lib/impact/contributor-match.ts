/**
 * Match contributor fields (email, 0x, ENS-as-written) to a connected identity.
 */
export type ContributorIdentity = {
  addresses: Array<string>
  emails?: string[]
}

function norm(value: string): string {
  return String(value).trim().toLowerCase()
}

export function addressSet(addresses: Array<string>): Set<string> {
  const out = new Set<string>()
  for (const raw of addresses) {
    const s = norm(String(raw))
    if (s.startsWith('0x') && s.length === 42) out.add(s)
  }
  return out
}

export function emailSet(emails: string[] | undefined): Set<string> {
  const out = new Set<string>()
  for (const raw of emails || []) {
    const s = norm(raw)
    if (s.includes('@')) out.add(s)
  }
  return out
}

/** True if a contributor field refers to this user (wallet, smart account, or email). */
export function contributorFieldMatches(contributorField: string, identity: ContributorIdentity): boolean {
  const c = norm(contributorField)
  if (!c) return false
  if (c.includes('@')) return emailSet(identity.emails).has(c)
  const addrs = addressSet(identity.addresses)
  if (c.startsWith('0x') && c.length === 42) return addrs.has(c)
  return false
}
