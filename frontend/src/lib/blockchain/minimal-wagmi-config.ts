import { cookieStorage, createConfig, createStorage, type Config } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { aaWagmiChains } from '@/lib/blockchain/aa-wagmi-chains'
import { aaWagmiHttpTransports } from '@/lib/blockchain/aa-wagmi-transports'
import { getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

function buildMinimalWagmiConfig(): Config {
  return createConfig({
    chains: [...aaWagmiChains],
    connectors: [
      // Prefer browser-injected providers (MetaMask extension / MiniPay / in-app browsers).
      // Avoid wagmi `metaMask()` SDK connector: it phones home to *.api.cx.metamask.io and
      // hangs when CSP or mobile deep-link analytics fail.
      injected({ shimDisconnect: true }),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: getWalletConnectMetadata(),
        qrModalOptions: {
          themeMode: 'dark',
        },
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    transports: aaWagmiHttpTransports(),
    ssr: true,
  })
}

function missingAaTransport(config: Config): boolean {
  return aaWagmiChains.some((chain) => {
    try {
      config.getClient({ chainId: chain.id })
      return false
    } catch {
      return true
    }
  })
}

let serverSingleton: Config | null = null
let clientSingleton: Config | null = null

/** SSR cookie hydration only - same connector options as client. */
export function getServerMinimalWagmiConfig(): Config {
  if (serverSingleton && missingAaTransport(serverSingleton)) serverSingleton = null
  if (!serverSingleton) serverSingleton = buildMinimalWagmiConfig()
  return serverSingleton
}

/** Client wagmi (created once per browser tab). */
export function createMinimalWagmiConfig(): Config {
  if (clientSingleton && missingAaTransport(clientSingleton)) clientSingleton = null
  if (!clientSingleton) clientSingleton = buildMinimalWagmiConfig()
  return clientSingleton
}

export function getMinimalWagmiConfig(): Config {
  if (typeof window === 'undefined') return getServerMinimalWagmiConfig()
  return createMinimalWagmiConfig()
}
