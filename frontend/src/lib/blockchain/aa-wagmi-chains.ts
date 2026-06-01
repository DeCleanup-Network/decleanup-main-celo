import { celo } from 'wagmi/chains'
import { defineChain, type Chain } from 'viem'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = getCeloSepoliaHttpRpcUrl()

export const celoMainnetChain = {
  ...celo,
  rpcUrls: {
    default: { http: [celoMainnetRpcUrl] },
    public: { http: [celoMainnetRpcUrl] },
  },
} satisfies Chain

export const celoSepoliaChain = defineChain({
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

/** Celo chains only — omit Ethereum mainnet so WC sessions default to Celo, not chain 1. */
export const aaWagmiChains: readonly [Chain, ...Chain[]] =
  REQUIRED_CHAIN_ID === 42220
    ? ([celoMainnetChain, celoSepoliaChain] as const)
    : ([celoSepoliaChain, celoMainnetChain] as const)
