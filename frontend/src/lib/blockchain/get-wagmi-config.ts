/**
 * Runtime wagmi config getter so contract code can use the active provider's config
 * without importing wagmi.ts (which would load RainbowKit/Lit on the embedded path).
 * Set by WagmiConfigSync inside whichever provider is mounted (Privy or RainbowKit).
 */
import type { Config } from 'wagmi'

let current: Config | null = null

export function setWagmiConfig(config: Config | null): void {
  current = config
}

export function getConfig(): Config {
  if (!current) {
    throw new Error('Wagmi config not set. Ensure you are inside a WagmiProvider (Privy or RainbowKit).')
  }
  return current
}
