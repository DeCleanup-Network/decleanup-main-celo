import 'server-only'

/** EOA + optional legacy smart account for portfolio-related Supabase lookups. */
export function portfolioLookupAddresses(
  eoaAddress: string,
  legacySmartAccount?: string | null
): string[] {
  const eoa = eoaAddress.toLowerCase()
  const out = new Set<string>([eoa])
  const legacy = legacySmartAccount?.toLowerCase()
  if (legacy && legacy !== eoa) out.add(legacy)
  return Array.from(out)
}
