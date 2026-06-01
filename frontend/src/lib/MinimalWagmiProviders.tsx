'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { useEffect, useState, type ReactNode } from 'react'
import {
  createMinimalWagmiConfig,
  getServerMinimalWagmiConfig,
} from '@/lib/blockchain/minimal-wagmi-config'
import type { Config } from 'wagmi'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { WalletConnectRelayRecovery } from '@/hooks/useWalletConnectRelayRecovery'

/**
 * Wagmi + React Query without RainbowKit in AA auth mode.
 * Client config uses mobile deep-link WC (no bottom AppKit sheet on Safari).
 */
export function MinimalWagmiProviders({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config, setConfig] = useState<Config>(() => getServerMinimalWagmiConfig())
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  useEffect(() => {
    setConfig(createMinimalWagmiConfig())
  }, [])

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount>
      <WagmiConfigSync />
      <WalletConnectRelayRecovery />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
