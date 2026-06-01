import { celo } from 'wagmi/chains'
import { defineChain } from 'viem'
import { cookieStorage, createConfig, createStorage, http, type Config } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'

const celoMainnetRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
const celoSepoliaRpcUrl = getCeloSepoliaHttpRpcUrl()

const celoMainnet = {
  ...celo,
  rpcUrls: {
    default: { http: [celoMainnetRpcUrl] },
    public: { http: [celoMainnetRpcUrl] },
  },
}

const celoSepoliaChain = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
  rpcUrls: {
    default: { http: [celoSepoliaRpcUrl] },
    public: { http: [celoSepoliaRpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Celo Sepolia Explorer', url: 'https://celo-sepolia.blockscout.com' },
  },
  testnet: true,
})

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

/** Celo chains only — omit Ethereum mainnet so WC sessions default to Celo, not chain 1. */
const chains =
  REQUIRED_CHAIN_ID === 42220
    ? ([celoMainnet, celoSepoliaChain] as const)
    : ([celoSepoliaChain, celoMainnet] as const)

/**
 * Create wagmi config on the client so WalletConnect options (e.g. showQrModal) are not
 * frozen from SSR module evaluation.
 */
export function createMinimalWagmiConfig(): Config {
  return createConfig({
    chains: [...chains],
    connectors: [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: getWalletConnectMetadata(),
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    transports: {
      [celoMainnet.id]: http(celoMainnetRpcUrl),
      [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    },
    ssr: true,
  })
}

let singletonConfig: Config | null = null

/**
 * Single wagmi config instance for SSR cookie hydration + client provider.
 */
export function getMinimalWagmiConfig(): Config {
  if (!singletonConfig) {
    singletonConfig = createMinimalWagmiConfig()
  }
  return singletonConfig
}

/** @deprecated Use getMinimalWagmiConfig(). */
export const minimalWagmiConfig = getMinimalWagmiConfig()
