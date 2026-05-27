import { celo, mainnet } from 'wagmi/chains'
import { defineChain } from 'viem'
import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { getCeloSepoliaHttpRpcUrl } from '@/lib/blockchain/celo-sepolia-rpc-url'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

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

/**
 * Wagmi for AA auth mode — connectors for MetaMask / WalletConnect without nesting a second
 * WagmiProvider on /login (that broke “connected on login, logged out on home”).
 */
const chains =
  REQUIRED_CHAIN_ID === 42220
    ? ([celoMainnet, celoSepoliaChain, mainnet] as const)
    : ([celoSepoliaChain, celoMainnet, mainnet] as const)

export const minimalWagmiConfig = createConfig({
  chains: [...chains],
  connectors: [
    injected(),
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [celoMainnet.id]: http(celoMainnetRpcUrl),
    [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    [mainnet.id]: http(),
  },
  ssr: true,
})
