'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { createMinimalWagmiConfig } from '@/lib/blockchain/minimal-wagmi-config'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { WalletConnectRelayRecovery } from '@/hooks/useWalletConnectRelayRecovery'
import { WalletConnectUriOpener } from '@/components/wallet/WalletConnectUriOpener'

/**
 * Wagmi + React Query without RainbowKit in AA auth mode.
 * Client config is created once on mount (avoid server showQrModal:false connector stuck on mobile).
 */
export function MinimalWagmiProviders({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(createMinimalWagmiConfig)
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

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount>
      <WagmiConfigSync />
      <WalletConnectRelayRecovery />
      <WalletConnectUriOpener />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
