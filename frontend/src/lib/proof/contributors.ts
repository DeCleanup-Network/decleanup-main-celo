/**
 * Identities people actually entered on an impact report.
 * Does not invent names — only email, wallet, or ENS when those strings are present.
 */

const WALLET = /^0x[a-fA-F0-9]{40}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const ENS = /^[a-z0-9-]+\.eth$/i

export type ContributorKind = 'address' | 'email' | 'ens'

export function extractContributorIdentity(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (WALLET.test(text) || EMAIL.test(text) || ENS.test(text)) return text
  const email = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)
  if (email) return email[0]
  const wallet = text.match(/0x[a-fA-F0-9]{40}/)
  if (wallet) return wallet[0]
  const ens = text.match(/\b[a-z0-9-]+\.eth\b/i)
  if (ens) return ens[0]
  return null
}

export function parseContributorIdentities(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const identity = extractContributorIdentity(item)
    if (!identity) continue
    const key = identity.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(identity)
  }
  return out
}

export function contributorKind(value: string): ContributorKind | null {
  if (WALLET.test(value)) return 'address'
  if (EMAIL.test(value)) return 'email'
  if (ENS.test(value)) return 'ens'
  return null
}
