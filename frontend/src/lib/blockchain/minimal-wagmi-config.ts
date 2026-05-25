import { celo, mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'

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
  blockExplorers: {
    default: { name: 'Celo Sepolia Explorer', url: 'https://celo-sepolia.blockscout.com' },
  },
  testnet: true,
})

/**
 * Lightweight wagmi config for AA auth mode — no RainbowKit / WalletConnect AppKit bundle.
 * Use RainbowKit `config` from wagmi.ts only when RainbowKit connect UI is active.
 */
export const minimalWagmiConfig = createConfig({
  chains: [celoSepoliaChain, celoMainnet, mainnet],
  transports: {
    [celoMainnet.id]: http(celoMainnetRpcUrl),
    [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    [mainnet.id]: http(),
  },
  ssr: true,
})
