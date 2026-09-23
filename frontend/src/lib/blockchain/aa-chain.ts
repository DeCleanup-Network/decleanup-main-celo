/**
 * AA / Pimlico helpers for the active chain (Celo or Base).
 * Bundler slug comes from CHAIN_CONFIGS — do not hardcode celo vs celo-sepolia.
 */

import { base, baseSepolia, celo, type Chain } from 'viem/chains'
import { defineChain } from 'viem'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  CHAIN_CONFIGS,
  REQUIRED_CHAIN_ID,
  REQUIRED_RPC_URL,
  getChainConfig,
  type SupportedChainId,
} from './chain-constants'

export function isSupportedChainId(id: number): id is SupportedChainId {
  return id === CELO_MAINNET_CHAIN_ID ||
    id === CELO_SEPOLIA_CHAIN_ID ||
    id === BASE_MAINNET_CHAIN_ID ||
    id === BASE_SEPOLIA_CHAIN_ID
}

export function getActivePimlicoSlug(chainId: number = REQUIRED_CHAIN_ID): string {
  if (!isSupportedChainId(chainId)) return CHAIN_CONFIGS[CELO_SEPOLIA_CHAIN_ID].pimlicoSlug
  return CHAIN_CONFIGS[chainId].pimlicoSlug
}

export function getPimlicoBundlerUrl(apiKey: string, chainId: number = REQUIRED_CHAIN_ID): string {
  return `https://api.pimlico.io/v2/${getActivePimlicoSlug(chainId)}/rpc?apikey=${apiKey}`
}

export function getActiveNativeGasSymbol(chainId: number = REQUIRED_CHAIN_ID): string {
  return chainId === BASE_MAINNET_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID ? 'ETH' : 'CELO'
}

export function getActiveAaChain(chainId: number = REQUIRED_CHAIN_ID): Chain {
  const config = isSupportedChainId(chainId)
    ? getChainConfig(chainId)
    : getChainConfig(CELO_SEPOLIA_CHAIN_ID)
  const rpcUrl = chainId === REQUIRED_CHAIN_ID ? REQUIRED_RPC_URL : config.rpcUrl

  if (config.id === CELO_MAINNET_CHAIN_ID) {
    return {
      ...celo,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    }
  }

  if (config.id === BASE_MAINNET_CHAIN_ID) {
    return {
      ...base,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    }
  }

  if (config.id === BASE_SEPOLIA_CHAIN_ID) {
    return {
      ...baseSepolia,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    }
  }

  return defineChain({
    id: CELO_SEPOLIA_CHAIN_ID,
    name: config.name,
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'Celo Sepolia Explorer', url: config.blockExplorerUrl },
    },
    testnet: true,
  })
}
