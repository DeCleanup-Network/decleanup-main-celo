import { celo } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { walletConnect, injected } from 'wagmi/connectors'
import { defineChain, type Chain } from 'viem'

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

const configuredChains: [Chain, ...Chain[]] = [celoSepoliaChain, celoMainnet]
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
  'https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png'

// Wagmi configuration with standard Web3 wallet support
// Note: Using explicit connectors to avoid VeChain hijacking window.ethereum.
// IMPORTANT: Only initialize connectors on client side to avoid SSR errors
// All wallet connectors require browser APIs and will fail during server-side rendering
// Valora wallet uses WalletConnect protocol and will appear in the WalletConnect modal
const connectors = []

// Only add injected connector if we are on the client and window.ethereum exists
if (typeof window !== 'undefined' && (window as any).ethereum) {
  connectors.push(
    injected({
      shimDisconnect: true,
      target() {
        return {
          id: 'browser',
          name: 'Browser',
          provider: (window as any).ethereum,
        }
      },
    })
  )
}

// Only add WalletConnect if Project ID is configured and on client side
// Use dynamic URL to avoid metadata mismatch warnings (localhost vs production)
// Only add WalletConnect if Project ID is configured and on client side
// Use dynamic URL to avoid metadata mismatch warnings (localhost vs production)
// Fallback to a default Project ID if not configured (for development/testing)
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64'

if (typeof window !== 'undefined') {
  if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
    console.warn('Using default WalletConnect Project ID. Please configure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local')
  }

  try {
    // Get current URL dynamically to match the actual page URL
    // This fixes the "metadata.url differs from actual page url" warning
    const currentUrl = window.location.origin

    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: APP_NAME,
          description: APP_DESCRIPTION,
          url: currentUrl, // Use current URL (localhost in dev, production in prod)
          icons: [APP_ICON_URL],
        },
        showQrModal: true, // Show QR code for mobile wallet connections (includes Valora)
      }) as any // Type assertion needed due to WalletConnect type incompatibility
    )
  } catch (error) {
    console.warn('WalletConnect connector initialization failed:', error)
  }
}

export const config = createConfig({
  chains: configuredChains,
  connectors,
  transports: {
    [celoMainnet.id]: http(celoMainnetRpcUrl),
    [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
  },
})

// Default/Celo chain metadata exports
export const DEFAULT_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_ID = requiredChainId
export const REQUIRED_CHAIN_NAME = requiredChainLabel
export const REQUIRED_BLOCK_EXPLORER_URL = requiredBlockExplorerUrl
export const REQUIRED_RPC_URL = requiredRpcUrl
export const REQUIRED_CHAIN_IS_TESTNET = Boolean(requiredChain.testnet)

// Contract addresses (update with actual addresses after deployment)
// Canonical names: NEXT_PUBLIC_IMPACT_PRODUCT_NFT, NEXT_PUBLIC_VERIFICATION_CONTRACT, NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT
// Legacy names kept for backwards compatibility
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT:
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
    process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
    '',
  VERIFICATION:
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
    '',
  REWARD_DISTRIBUTOR:
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
    '',
} as const

