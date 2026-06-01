import { http, cookieStorage, createConfig, createStorage, type Config } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { aaWagmiChains, celoMainnetChain, celoSepoliaChain } from '@/lib/blockchain/aa-wagmi-chains'
import { getWalletConnectMetadata } from '@/lib/blockchain/wallet-connect-metadata'

const celoMainnetRpcUrl = celoMainnetChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'
const celoSepoliaRpcUrl = celoSepoliaChain.rpcUrls.default.http[0] ?? 'https://forno.celo.org'

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || '3a8170812b534d0ff9d794f19a901d64'

/**
 * Server-safe wagmi config for cookie hydration in AA mode.
 * Avoids importing RainbowKit during Next.js static page collection.
 */
export function getAaWagmiCookieConfig(): Config {
  return createConfig({
    chains: [...aaWagmiChains],
    connectors: [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
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

let singleton: Config | null = null

export function getAaWagmiCookieConfigSingleton(): Config {
  if (!singleton) singleton = getAaWagmiCookieConfig()
  return singleton
}
