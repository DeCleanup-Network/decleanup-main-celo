'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { getMinimalWagmiConfig } from '@/lib/blockchain/minimal-wagmi-config'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { WalletConnectRelayRecovery } from '@/hooks/useWalletConnectRelayRecovery'

/**
 * Wagmi + React Query without RainbowKit/Privy.
 * Required so shared layout hooks (useAccount, useConfig) work in AA auth mode.
 */
export function MinimalWagmiProviders({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(getMinimalWagmiConfig)
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
