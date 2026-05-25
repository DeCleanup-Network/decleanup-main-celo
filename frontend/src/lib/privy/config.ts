'use client'

import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_RPC_URL,
  REQUIRED_CHAIN_NAME,
  REQUIRED_BLOCK_EXPLORER_URL,
} from '@/lib/blockchain/chain-constants'

const celoSepolia = defineChain({
  id: 11142220,
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
  id: 42220,
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

const activeChain = REQUIRED_CHAIN_ID === 42220 ? celoMainnet : celoSepolia

export const config = createConfig({
  chains: [activeChain, mainnet], // Include mainnet for ENS resolution
  transports: {
    [celoSepolia.id]: http(),
    [celoMainnet.id]: http(),
    [mainnet.id]: http(),
  },
})
