/**
 * Chain IDs, RPC URLs, and contract addresses only.
 * Import from here in Web3Auth/embedded-wallet code so we don’t pull in wagmi.ts
 * (which loads RainbowKit/Lit and triggers "Lit is in dev mode" etc.).
 */

import { resolveCeloSepoliaUpstreamRpc, CELO_SEPOLIA_FORNO_RPC } from './celo-sepolia-upstream-rpc'

const CELO_SEPOLIA_CHAIN_ID = 11142220
const CELO_MAINNET_CHAIN_ID = 42220

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = resolveCeloSepoliaUpstreamRpc(
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || CELO_SEPOLIA_FORNO_RPC
)

const parsedChainEnv = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '')
const requiredChainId =
  parsedChainEnv === CELO_MAINNET_CHAIN_ID || parsedChainEnv === CELO_SEPOLIA_CHAIN_ID
    ? parsedChainEnv
    : CELO_SEPOLIA_CHAIN_ID

const isTestnet = requiredChainId !== CELO_MAINNET_CHAIN_ID

export const REQUIRED_CHAIN_ID = requiredChainId
/** Hex string for wallet_switchEthereumChain / Web3Auth switchChain (lowercase; must match Web3Auth `chains[].chainId`). */
export const REQUIRED_CHAIN_ID_HEX = `0x${requiredChainId.toString(16)}` as const
export const DEFAULT_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_NAME = isTestnet ? 'Celo Sepolia Testnet' : 'Celo Mainnet'
export const REQUIRED_BLOCK_EXPLORER_URL = isTestnet
  ? 'https://celo-sepolia.blockscout.com'
  : 'https://celoscan.io'
export const REQUIRED_RPC_URL = isTestnet ? celoSepoliaRpcUrl : celoMainnetRpcUrl
export const REQUIRED_CHAIN_IS_TESTNET = isTestnet

/** Impact Product NFT max level; at this level new cleanup submissions are disabled in the app. */
export const MAX_IMPACT_PRODUCT_LEVEL = 10

export const CONTRACT_ADDRESSES = {
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
} as const
