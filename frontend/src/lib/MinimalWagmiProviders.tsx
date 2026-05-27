'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { minimalWagmiConfig } from '@/lib/blockchain/minimal-wagmi-config'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'

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
    <WagmiProvider config={minimalWagmiConfig} initialState={initialState} reconnectOnMount>
      <WagmiConfigSync />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
