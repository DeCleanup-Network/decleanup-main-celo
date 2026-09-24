/**
 * Runtime wagmi config getter so contract code can use the active provider's config
 * without importing wagmi.ts (which would load RainbowKit/Lit on the embedded path).
 * Set by WagmiConfigSync inside whichever provider is mounted (Privy or RainbowKit).
 *
 * On the server (API routes, impact sync), falls back to a read-only config so
 * contract reads work without a browser WagmiProvider.
 */
import type { Config } from 'wagmi'
import { createConfig, http } from 'wagmi'
import {
  aaWagmiChains,
  baseMainnetChain,
  baseSepoliaChain,
  celoMainnetChain,
  celoSepoliaChain,
} from '@/lib/blockchain/aa-wagmi-chains'

let current: Config | null = null
let serverReadConfig: Config | null = null

function rpc(chain: { rpcUrls: { default: { http: readonly string[] } } }, fallback: string) {
  return chain.rpcUrls.default.http[0] ?? fallback
}

function getServerReadConfig(): Config {
  if (serverReadConfig) return serverReadConfig

  serverReadConfig = createConfig({
    chains: [...aaWagmiChains],
    transports: {
      [celoSepoliaChain.id]: http(rpc(celoSepoliaChain, 'https://forno.celo.org')),
      [celoMainnetChain.id]: http(rpc(celoMainnetChain, 'https://forno.celo.org')),
      [baseMainnetChain.id]: http(rpc(baseMainnetChain, 'https://mainnet.base.org')),
      [baseSepoliaChain.id]: http(rpc(baseSepoliaChain, 'https://sepolia.base.org')),
    },
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
