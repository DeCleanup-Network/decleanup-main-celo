import { defineChain } from 'viem'
import {
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

/** Viem chain object for wallet writes (matches NEXT_PUBLIC_CHAIN_ID). */
export const requiredViemChain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
  rpcUrls: {
    default: { http: [REQUIRED_RPC_URL] },
    public: { http: [REQUIRED_RPC_URL] },
  },
  blockExplorers: REQUIRED_BLOCK_EXPLORER_URL
    ? { default: { name: 'Explorer', url: REQUIRED_BLOCK_EXPLORER_URL } }
    : undefined,
  testnet: REQUIRED_CHAIN_ID !== 42220,
})
