import { base, baseSepolia, celo } from 'viem/chains'
import { defineChain, type Chain } from 'viem'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'
import { REQUIRED_CHAIN_ID, ROBINHOOD_TESTNET_CHAIN_ID } from '@/lib/blockchain/chain-constants'

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = getCeloSepoliaHttpRpcUrl()
const baseMainnetRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
const baseSepoliaRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
const robinhoodTestnetRpcUrl =
  process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com'

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

export const baseMainnetChain = {
  ...base,
  rpcUrls: {
    default: { http: [baseMainnetRpcUrl] },
    public: { http: [baseMainnetRpcUrl] },
  },
} satisfies Chain

export const baseSepoliaChain = {
  ...baseSepolia,
  rpcUrls: {
    default: { http: [baseSepoliaRpcUrl] },
    public: { http: [baseSepoliaRpcUrl] },
  },
} satisfies Chain

export const robinhoodTestnetChain = defineChain({
  id: ROBINHOOD_TESTNET_CHAIN_ID,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [robinhoodTestnetRpcUrl] },
    public: { http: [robinhoodTestnetRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Testnet Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
  testnet: true,
})

/** Active chain first so WalletConnect / AA sessions default to the picker choice. */
export const aaWagmiChains: readonly [Chain, ...Chain[]] =
  REQUIRED_CHAIN_ID === ROBINHOOD_TESTNET_CHAIN_ID
    ? ([robinhoodTestnetChain, celoMainnetChain, baseMainnetChain, celoSepoliaChain, baseSepoliaChain] as const)
    : REQUIRED_CHAIN_ID === 8453
      ? ([baseMainnetChain, celoMainnetChain, celoSepoliaChain, baseSepoliaChain, robinhoodTestnetChain] as const)
      : REQUIRED_CHAIN_ID === 84532
        ? ([baseSepoliaChain, celoMainnetChain, celoSepoliaChain, baseMainnetChain, robinhoodTestnetChain] as const)
        : REQUIRED_CHAIN_ID === 42220
          ? ([celoMainnetChain, baseMainnetChain, celoSepoliaChain, baseSepoliaChain, robinhoodTestnetChain] as const)
          : ([celoSepoliaChain, celoMainnetChain, baseMainnetChain, baseSepoliaChain, robinhoodTestnetChain] as const)
