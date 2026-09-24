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
  CHAIN_PREFERENCE_KEY,
  REQUIRED_CHAIN_ID,
  REQUIRED_RPC_URL,
  getChainConfig,
  type SupportedChainId,
} from './chain-constants'

/** Live Celo/Base pick when no chainId is passed. Server stays on REQUIRED_CHAIN_ID (env). */
export function resolveActiveChainId(explicit?: number): number {
  if (explicit != null && isSupportedChainId(explicit)) return explicit
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(CHAIN_PREFERENCE_KEY)
    if (stored) {
      const id = Number(stored)
      if (isSupportedChainId(id)) return id
    }
  }
  return REQUIRED_CHAIN_ID
}

export function isSupportedChainId(id: number): id is SupportedChainId {
  return id === CELO_MAINNET_CHAIN_ID ||
    id === CELO_SEPOLIA_CHAIN_ID ||
    id === BASE_MAINNET_CHAIN_ID ||
    id === BASE_SEPOLIA_CHAIN_ID
}

export function getActivePimlicoSlug(chainId?: number): string {
  const id = resolveActiveChainId(chainId)
  if (!isSupportedChainId(id)) return CHAIN_CONFIGS[CELO_SEPOLIA_CHAIN_ID].pimlicoSlug
  return CHAIN_CONFIGS[id].pimlicoSlug
}

export function getPimlicoBundlerUrl(apiKey: string, chainId?: number): string {
  return `https://api.pimlico.io/v2/${getActivePimlicoSlug(chainId)}/rpc?apikey=${apiKey}`
}

export function getActiveNativeGasSymbol(chainId?: number): string {
  const id = resolveActiveChainId(chainId)
  return id === BASE_MAINNET_CHAIN_ID || id === BASE_SEPOLIA_CHAIN_ID ? 'ETH' : 'CELO'
}

export function getActiveAaChain(chainId?: number): Chain {
  const resolved = resolveActiveChainId(chainId)
  const config = isSupportedChainId(resolved)
    ? getChainConfig(resolved)
    : getChainConfig(CELO_SEPOLIA_CHAIN_ID)
  const rpcUrl = resolved === REQUIRED_CHAIN_ID ? REQUIRED_RPC_URL : config.rpcUrl

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
