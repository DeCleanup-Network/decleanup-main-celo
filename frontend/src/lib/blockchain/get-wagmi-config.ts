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
import { celo } from 'viem/chains'
import { defineChain } from 'viem'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'
import { REQUIRED_CHAIN_ID } from './chain-constants'

let current: Config | null = null
let serverReadConfig: Config | null = null

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = getCeloSepoliaHttpRpcUrl()

const celoMainnet = {
  ...celo,
  rpcUrls: {
    default: { http: [celoMainnetRpcUrl] },
    public: { http: [celoMainnetRpcUrl] },
  },
}

const celoSepoliaChain = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
  rpcUrls: {
    default: { http: [celoSepoliaRpcUrl] },
    public: { http: [celoSepoliaRpcUrl] },
  },
})

function getServerReadConfig(): Config {
  if (serverReadConfig) return serverReadConfig

  serverReadConfig = createConfig({
    chains: [celoSepoliaChain, celoMainnet],
    transports: {
      [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
      [celoMainnet.id]: http(celoMainnetRpcUrl),
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
