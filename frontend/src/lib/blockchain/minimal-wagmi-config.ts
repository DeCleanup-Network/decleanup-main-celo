import { cookieStorage, createConfig, createStorage, http, type Config } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { aaWagmiChains, celoMainnetChain, celoSepoliaChain } from '@/lib/blockchain/aa-wagmi-chains'
import { getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

const celoMainnetRpcUrl = celoMainnetChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'
const celoSepoliaRpcUrl = celoSepoliaChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

/** SSR / cookie hydration — modal options do not affect stored state. */
export function createServerMinimalWagmiConfig(): Config {
  return createConfig({
    chains: [...aaWagmiChains],
    connectors: [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: false,
        metadata: getWalletConnectMetadata(),
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    transports: {
      [celoMainnetChain.id]: http(celoMainnetRpcUrl),
      [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    },
    ssr: true,
  })
}

/**
 * Client wagmi for AA mode. Mobile: deep-link (no AppKit sheet). Desktop: WC QR modal.
 */
export function createMinimalWagmiConfig(): Config {
  const showQrModal = !isMobileBrowser()

  return createConfig({
    chains: [...aaWagmiChains],
    connectors: [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal,
        metadata: getWalletConnectMetadata(),
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    transports: {
      [celoMainnetChain.id]: http(celoMainnetRpcUrl),
      [celoSepoliaChain.id]: http(celoSepoliaRpcUrl),
    },
    ssr: true,
  })
}

let serverSingleton: Config | null = null
let clientSingleton: Config | null = null

export function getServerMinimalWagmiConfig(): Config {
  if (!serverSingleton) serverSingleton = createServerMinimalWagmiConfig()
  return serverSingleton
}

export function getMinimalWagmiConfig(): Config {
  if (typeof window === 'undefined') return getServerMinimalWagmiConfig()
  if (!clientSingleton) clientSingleton = createMinimalWagmiConfig()
  return clientSingleton
}

