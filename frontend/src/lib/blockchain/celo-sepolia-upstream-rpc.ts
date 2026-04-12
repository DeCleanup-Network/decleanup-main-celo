/**
 * Celo Sepolia (11142220) upstream RPC for server proxy and viem transports.
 * Legacy non-Sepolia testnet endpoints under celo-testnet.org often fail DNS
 * and must not be used as "Sepolia" RPC.
 */
export const CELO_SEPOLIA_FORNO_RPC = 'https://forno.celo-sepolia.celo-testnet.org'

function isDeprecatedLegacyTestnetRpc(lowerUrl: string): boolean {
  const isCeloTestnetHost = lowerUrl.includes('celo-testnet.org')
  const isSepoliaHost = lowerUrl.includes('celo-sepolia')
  return isCeloTestnetHost && !isSepoliaHost
}

export function resolveCeloSepoliaUpstreamRpc(url: string | undefined | null): string {
  const trimmed = url?.trim()
  if (!trimmed) return CELO_SEPOLIA_FORNO_RPC
  const lower = trimmed.toLowerCase()
  if (isDeprecatedLegacyTestnetRpc(lower)) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[DeCleanup] Deprecated legacy testnet RPC ignored; using Celo Sepolia Forno. Update NEXT_PUBLIC_SEPOLIA_RPC_URL in .env.local.'
      )
    }
    return CELO_SEPOLIA_FORNO_RPC
  }
  return trimmed
}
