import { celo, mainnet } from 'wagmi/chains'
import { defineChain, type Chain } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'

// Must be Celo mainnet (42220), not Alfajores (deprecated testnet) — wrong RPC causes CORS + wrong-chain reads.
const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
/** Browser-safe default: public forno sepolia often has no CORS; same-origin proxy + drpc fallback. */
const celoSepoliaRpcUrl = getCeloSepoliaHttpRpcUrl()

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

const APP_NAME = 'DeCleanup Rewards'

/**
 * WalletConnect compares `metadata.url` to the page URL. Using only build-time env breaks when the
 * same build is served on a custom domain (e.g. dapp.decleanup.net) vs the preview URL — use the live
 * origin in the browser when available.
 */
function getWalletConnectAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    (typeof process !== 'undefined' && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  )
}

const APP_URL = getWalletConnectAppUrl()
const APP_DESCRIPTION = 'Clean up, share proof, and earn tokenized environmental rewards on Celo.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_APP_ICON_URL ||
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

// Re-export chain constants (defined in chain-constants.ts to avoid loading RainbowKit in Web3Auth path)
export {
  DEFAULT_CHAIN_ID,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_RPC_URL,
  REQUIRED_CHAIN_IS_TESTNET,
  CONTRACT_ADDRESSES,
} from './chain-constants'

