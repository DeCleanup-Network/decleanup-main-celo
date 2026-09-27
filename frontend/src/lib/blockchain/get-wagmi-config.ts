/**
 * Runtime wagmi config getter so contract code can use the active provider's config
 * without importing wagmi.ts (which would load RainbowKit/Lit on the embedded path).
 * Set by WagmiConfigSync inside whichever provider is mounted (Privy or RainbowKit).
 *
 * On the server (API routes, impact sync), falls back to a read-only config so
 * contract reads work without a browser WagmiProvider.
 */
import type { Config } from 'wagmi'
import { createConfig } from 'wagmi'
import { aaWagmiChains } from '@/lib/blockchain/aa-wagmi-chains'
import { aaWagmiHttpTransports } from '@/lib/blockchain/aa-wagmi-transports'

let current: Config | null = null
let serverReadConfig: Config | null = null

function getServerReadConfig(): Config {
  if (serverReadConfig) return serverReadConfig

  serverReadConfig = createConfig({
    chains: [...aaWagmiChains],
    transports: aaWagmiHttpTransports(),
  })

  return serverReadConfig
}

export function setWagmiConfig(config: Config | null): void {
  current = config
}

export function getConfig(): Config {
  if (current) return current
  if (typeof window === 'undefined') {
    return getServerReadConfig()
  }
  throw new Error('Wagmi config not set. Ensure you are inside a WagmiProvider (Privy or RainbowKit).')
}
