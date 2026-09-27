/**
 * Chain IDs, RPC URLs, and contract addresses only.
 * Import from here in embedded-wallet code so we don’t pull in wagmi.ts
 * (which loads RainbowKit/Lit and triggers "Lit is in dev mode" etc.).
 */

import { resolveCeloSepoliaUpstreamRpc, CELO_SEPOLIA_FORNO_RPC } from './celo-sepolia-upstream-rpc'

export const CELO_MAINNET_CHAIN_ID = 42220
export const CELO_SEPOLIA_CHAIN_ID = 11142220
export const BASE_MAINNET_CHAIN_ID = 8453
export const BASE_SEPOLIA_CHAIN_ID = 84532
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630

export const ROBINHOOD_HYPERCERT_MINTER = '0xC6a7eC8B1695023D3EE74ADC29972cD341AbA3Ea'

/** localStorage key for Celo vs Base experience. Read in getInitialChainId(). */
export const CHAIN_PREFERENCE_KEY = 'decleanup-chain-id'

export type SupportedChainId =
  | typeof CELO_MAINNET_CHAIN_ID
  | typeof CELO_SEPOLIA_CHAIN_ID
  | typeof BASE_MAINNET_CHAIN_ID
  | typeof BASE_SEPOLIA_CHAIN_ID
  | typeof ROBINHOOD_TESTNET_CHAIN_ID

/**
 * Multi-Chain configuration map.
 */
export const CHAIN_CONFIGS: Record<
  SupportedChainId,
  {
    id: SupportedChainId
    name: string
    isTestnet: boolean
    rpcUrl: string
    blockExplorerUrl: string
    pimlicoSlug: string
    contracts: {
      IMPACT_PRODUCT: string
      VERIFICATION: string
      REWARD_DISTRIBUTOR: string
      DCU_TOKEN: string
      CLAIMVAULT: string
    }
  }
> = {
  [CELO_MAINNET_CHAIN_ID]: {
    id: CELO_MAINNET_CHAIN_ID,
    name: 'Celo Mainnet',
    isTestnet: false,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org',
    blockExplorerUrl: 'https://celoscan.io',
    pimlicoSlug: 'celo',
    contracts: {
      IMPACT_PRODUCT:
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT ||
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
        '',
      VERIFICATION: process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT || '',
      REWARD_DISTRIBUTOR:
        process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
        process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
        '',
      DCU_TOKEN:
        process.env.NEXT_PUBLIC_DCU_TOKEN_CONTRACT || process.env.NEXT_PUBLIC_CDCU_TOKEN_ADDRESS || '',
      CLAIMVAULT: process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS || '',
    },
  },
  [CELO_SEPOLIA_CHAIN_ID]: {
    id: CELO_SEPOLIA_CHAIN_ID,
    name: 'Celo Sepolia Testnet',
    isTestnet: true,
    rpcUrl: resolveCeloSepoliaUpstreamRpc(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || CELO_SEPOLIA_FORNO_RPC
    ),
    blockExplorerUrl: 'https://celo-sepolia.blockscout.com',
    pimlicoSlug: 'celo-sepolia',
    contracts: {
      IMPACT_PRODUCT:
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT ||
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
        process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
        '',
      VERIFICATION: process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT || '',
      REWARD_DISTRIBUTOR:
        process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
        process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
        '',
      DCU_TOKEN:
        process.env.NEXT_PUBLIC_DCU_TOKEN_CONTRACT || process.env.NEXT_PUBLIC_CDCU_TOKEN_ADDRESS || '',
      CLAIMVAULT: process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS || '',
    },
  },
  [BASE_MAINNET_CHAIN_ID]: {
    id: BASE_MAINNET_CHAIN_ID,
    name: 'Base',
    isTestnet: false,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorerUrl: 'https://basescan.org',
    pimlicoSlug: 'base',
    contracts: {
      IMPACT_PRODUCT: process.env.NEXT_PUBLIC_BASE_IMPACT_PRODUCT_NFT || '0x8D71Cd7445423CD42293E196B91E47f085E81BCf',
      VERIFICATION: process.env.NEXT_PUBLIC_BASE_SUBMISSION_CONTRACT || '0x69715d43EA6D46F65045FCe2391D9B7F89ec819F',
      REWARD_DISTRIBUTOR: process.env.NEXT_PUBLIC_BASE_REWARD_DISTRIBUTOR_CONTRACT || '0x492065137E07c660DCfAe4dC335A3Fa9C1203dd9',
      DCU_TOKEN: process.env.NEXT_PUBLIC_BASE_BDCU_TOKEN_ADDRESS || '0x30171b7014c02229497cde6745dd3ad821f12b07',
      CLAIMVAULT: process.env.NEXT_PUBLIC_BASE_CLAIMVAULT_ADDRESS || '',
    },
  },
  [BASE_SEPOLIA_CHAIN_ID]: {
    id: BASE_SEPOLIA_CHAIN_ID,
    name: 'Base Sepolia',
    isTestnet: true,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    pimlicoSlug: 'base-sepolia',
    contracts: {
      IMPACT_PRODUCT: process.env.NEXT_PUBLIC_BASE_IMPACT_PRODUCT_NFT || '',
      VERIFICATION: process.env.NEXT_PUBLIC_BASE_SUBMISSION_CONTRACT || '',
      REWARD_DISTRIBUTOR: process.env.NEXT_PUBLIC_BASE_REWARD_DISTRIBUTOR_CONTRACT || '',
      DCU_TOKEN: process.env.NEXT_PUBLIC_BASE_BDCU_TOKEN_ADDRESS || '',
      CLAIMVAULT: process.env.NEXT_PUBLIC_BASE_CLAIMVAULT_ADDRESS || '',
    },
  },
  [ROBINHOOD_TESTNET_CHAIN_ID]: {
    id: ROBINHOOD_TESTNET_CHAIN_ID,
    name: 'Robinhood Chain Testnet',
    isTestnet: true,
    rpcUrl: process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
    blockExplorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    pimlicoSlug: 'robinhood-testnet',
    contracts: {
      IMPACT_PRODUCT:
        process.env.NEXT_PUBLIC_ROBINHOOD_IMPACT_PRODUCT_NFT ||
        '0xC6523bF318e39B6d9DfBcd95aed9d5C3c5d041d1',
      VERIFICATION:
        process.env.NEXT_PUBLIC_ROBINHOOD_SUBMISSION_CONTRACT ||
        '0xdB960937821678fb7d029d1611059a04bf1F3046',
      REWARD_DISTRIBUTOR:
        process.env.NEXT_PUBLIC_ROBINHOOD_REWARD_DISTRIBUTOR_CONTRACT ||
        '0x9423d79dcd7f108dF5749a537fbE92577CdE1902',
      DCU_TOKEN:
        process.env.NEXT_PUBLIC_ROBINHOOD_DCU_TOKEN_ADDRESS ||
        '0x569a7Fd5B15ca7E6aCc8840CaE0735eCb5416A5F',
      CLAIMVAULT: process.env.NEXT_PUBLIC_ROBINHOOD_CLAIMVAULT_ADDRESS || '',
    },
  },
}

/**
 * Resolve the initial Chain ID.
 * In the browser (client), prioritizes the user's choice saved in localStorage.
 * On the server (SSR/API), uses the .env (fallback Celo Sepolia).
 */
function getInitialChainId(): SupportedChainId {
  const envChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '')
  const fallback = (
    envChainId === CELO_MAINNET_CHAIN_ID ||
    envChainId === CELO_SEPOLIA_CHAIN_ID ||
    envChainId === BASE_MAINNET_CHAIN_ID ||
    envChainId === BASE_SEPOLIA_CHAIN_ID ||
    envChainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? envChainId
      : CELO_SEPOLIA_CHAIN_ID
  ) as SupportedChainId

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(CHAIN_PREFERENCE_KEY)
    if (stored) {
      const id = Number(stored) as SupportedChainId
      if (CHAIN_CONFIGS[id]) return id
    }
  }
  return fallback
}

const requiredChainId = getInitialChainId()
const activeConfig = CHAIN_CONFIGS[requiredChainId]

/**
 * DEPRECATED: Kept to not break the 40+ existing references.
 */
export const REQUIRED_CHAIN_ID = requiredChainId
export const DEFAULT_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_ID_HEX = `0x${requiredChainId.toString(16)}` as const
export const REQUIRED_CHAIN_NAME = activeConfig.name
export const REQUIRED_BLOCK_EXPLORER_URL = activeConfig.blockExplorerUrl
export const REQUIRED_RPC_URL = activeConfig.rpcUrl
export const REQUIRED_CHAIN_IS_TESTNET = activeConfig.isTestnet

export const MAX_IMPACT_PRODUCT_LEVEL = 10

export const CONTRACT_ADDRESSES = activeConfig.contracts

export function getChainConfig(chainId: SupportedChainId) {
  return CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS[CELO_SEPOLIA_CHAIN_ID]
}