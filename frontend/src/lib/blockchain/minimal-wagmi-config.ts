import { cookieStorage, createConfig, createStorage, http, type Config } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { aaWagmiChains, celoMainnetChain, celoSepoliaChain } from '@/lib/blockchain/aa-wagmi-chains'
import { getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'

const celoMainnetRpcUrl = celoMainnetChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'
const celoSepoliaRpcUrl = celoSepoliaChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

function buildMinimalWagmiConfig(): Config {
  return createConfig({
    chains: [...aaWagmiChains],
    connectors: [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
        // AppKit modal on desktop; on mobile Safari we also deep-link via WalletConnectUriOpener.
        showQrModal: true,
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

/** SSR cookie hydration only — same connector options as client. */
export function getServerMinimalWagmiConfig(): Config {
  if (!serverSingleton) serverSingleton = buildMinimalWagmiConfig()
  return serverSingleton
}

/** Client wagmi (created once per browser tab). */
export function createMinimalWagmiConfig(): Config {
  if (!clientSingleton) clientSingleton = buildMinimalWagmiConfig()
  return clientSingleton
}

export function getMinimalWagmiConfig(): Config {
  if (typeof window === 'undefined') return getServerMinimalWagmiConfig()
  return createMinimalWagmiConfig()
}
