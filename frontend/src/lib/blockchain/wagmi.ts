import { celo, mainnet } from 'wagmi/chains'
import { defineChain, type Chain } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'

const celoMainnet = {
  ...celo,
  rpcUrls: {
    default: {
      http: [celoMainnetRpcUrl],
    },
    public: {
      http: [celoMainnetRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan',
      url: 'https://celoscan.io',
    },
  },
}

const celoSepoliaChain = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: [celoSepoliaRpcUrl],
    },
    public: {
      http: [celoSepoliaRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Explorer',
      url: 'https://celo-sepolia.blockscout.com',
    },
  },
  testnet: true,
})

// Include Ethereum mainnet for ENS resolution (RainbowKit can resolve ENS even when on Celo)
const configuredChains: [Chain, ...Chain[]] = [celoSepoliaChain, celoMainnet, mainnet]
// Default to Celo Sepolia (11142220) for testing
// Change to celoMainnet.id (42220) after deploying contracts to mainnet
const requiredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || celoSepoliaChain.id)
const requiredChain =
  configuredChains.find((chain) => chain.id === requiredChainId) ?? celoSepoliaChain
const requiredChainLabel = requiredChain.testnet ? requiredChain.name : 'Celo Mainnet'

// Resolve block explorer + RPC URL based on the active chain
const requiredBlockExplorerUrl =
  requiredChain.id === celoMainnet.id
    ? 'https://celoscan.io'
    : 'https://celo-sepolia.blockscout.com'

const requiredRpcUrl =
  requiredChain.id === celoMainnet.id ? celoMainnetRpcUrl : celoSepoliaRpcUrl

const APP_NAME = 'DeCleanup Rewards'
const APP_URL = process.env.NEXT_PUBLIC_MINIAPP_URL || 'http://localhost:3000'
const APP_DESCRIPTION = 'Clean up, share proof, and earn tokenized environmental rewards on Celo.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_MINIAPP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafkreia2bx2ofiutdzyxyry5wfaq5kj7bcd4wvutpiw6bhbl35qdbmsat4?filename=iconDCU.png'

// RainbowKit configuration with getDefaultConfig
// getDefaultConfig automatically includes popular wallets (MetaMask, WalletConnect, Coinbase, etc.)
// and handles wallet filtering/grouping internally
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('Using default WalletConnect Project ID. Please configure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local')
}

export const config = getDefaultConfig({
  appName: APP_NAME,
  projectId: walletConnectProjectId,
  chains: configuredChains,
  transports: {
    [celoMainnet.id]: http(celoMainnetRpcUrl),
    [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    [mainnet.id]: http(), // Public RPC for ENS resolution
  },
  ssr: true, // Enable SSR support for Next.js
  appDescription: APP_DESCRIPTION,
  appUrl: APP_URL,
  appIcon: APP_ICON_URL,
})

// Default/Celo chain metadata exports
export const DEFAULT_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_NAME = requiredChainLabel
export const REQUIRED_BLOCK_EXPLORER_URL = requiredBlockExplorerUrl
export const REQUIRED_RPC_URL = requiredRpcUrl
export const REQUIRED_CHAIN_IS_TESTNET = Boolean(requiredChain.testnet)

// Contract addresses (update with actual addresses after deployment)
// Canonical names: NEXT_PUBLIC_IMPACT_PRODUCT_NFT, NEXT_PUBLIC_SUBMISSION_CONTRACT, NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT
// Legacy names kept for backwards compatibility
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT:
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    '',
  VERIFICATION:
    process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT ||
    '',
  REWARD_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
    '',
  DCU_TOKEN:
    process.env.NEXT_PUBLIC_DCU_TOKEN_CONTRACT ||
    '',
  /** ClaimVault: mint-on-claim $cDCU (Phase 2). */
  CLAIMVAULT:
    process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS ||
    '',
} as const

