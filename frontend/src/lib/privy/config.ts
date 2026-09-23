'use client'

import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { mainnet, base, baseSepolia } from 'wagmi/chains'
import { defineChain } from 'viem'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID
} from '@/lib/blockchain/chain-constants'

const celoSepolia = defineChain({
  id: CELO_SEPOLIA_CHAIN_ID,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: [REQUIRED_RPC_URL],
    },
    public: {
      http: [REQUIRED_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Explorer',
      url: REQUIRED_BLOCK_EXPLORER_URL,
    },
  },
  testnet: true,
})

const celoMainnet = defineChain({
  id: CELO_MAINNET_CHAIN_ID,
  name: 'Celo Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: ['https://forno.celo.org'],
    },
    public: {
      http: ['https://forno.celo.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan',
      url: 'https://celoscan.io',
    },
  },
})

// Define active chain based on the build-time env variable
const activeChain =
  REQUIRED_CHAIN_ID === CELO_MAINNET_CHAIN_ID
    ? celoMainnet
    : REQUIRED_CHAIN_ID === BASE_MAINNET_CHAIN_ID
    ? base
    : REQUIRED_CHAIN_ID === BASE_SEPOLIA_CHAIN_ID
    ? baseSepolia
    : celoSepolia

export const config = createConfig({
  // Include all supported chains so Privy allows switching to Base in the future
  chains: [activeChain, celoSepolia, celoMainnet, base, baseSepolia, mainnet], 
  transports: {
    [celoSepolia.id]: http(),
    [celoMainnet.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
  },
})