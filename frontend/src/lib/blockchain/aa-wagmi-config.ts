import type { Config } from 'wagmi'
import { http } from 'wagmi'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  metaMaskWallet,
  valoraWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { getWalletConnectAppUrl, getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'
import { aaWagmiChains, celoMainnetChain, celoSepoliaChain } from '@/lib/blockchain/aa-wagmi-chains'

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl =
  celoSepoliaChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'

const APP_NAME = 'DeCleanup Rewards'
const APP_DESCRIPTION =
  'Clean up, share proof, and earn tokenized environmental rewards on Celo.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_APP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafkreia2bx2ofiutdzyxyry5wfaq5kj7bcd4wvutpiw6bhbl35qdbmsat4?filename=iconDCU.png'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn(
    'Using default WalletConnect Project ID. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in production.'
  )
}

export { aaWagmiChains, celoMainnetChain, celoSepoliaChain } from '@/lib/blockchain/aa-wagmi-chains'

export function createAaRainbowKitConfig(): Config {
  const metadata = getWalletConnectMetadata()

  return getDefaultConfig({
    appName: APP_NAME,
    appDescription: APP_DESCRIPTION,
    appUrl: getWalletConnectAppUrl(),
    appIcon: APP_ICON_URL,
    projectId: walletConnectProjectId,
    chains: aaWagmiChains,
    ssr: true,
    wallets: [
      {
        groupName: 'Connect',
        wallets: [walletConnectWallet, metaMaskWallet, valoraWallet, coinbaseWallet],
      },
    ],
    walletConnectParameters: {
      metadata,
    },
    transports: {
      [celoMainnetChain.id]: http(celoMainnetRpcUrl),
      [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    },
  })
}

let singletonConfig: Config | null = null

/** Wagmi + RainbowKit config (client-only; do not import from Server Components). */
export function getAaRainbowKitConfig(): Config {
  if (typeof window === 'undefined') {
    throw new Error('getAaRainbowKitConfig() is client-only.')
  }
  if (!singletonConfig) {
    singletonConfig = createAaRainbowKitConfig()
  }
  return singletonConfig
}
