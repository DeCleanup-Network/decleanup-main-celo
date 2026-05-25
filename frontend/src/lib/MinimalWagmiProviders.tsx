'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { minimalWagmiConfig } from '@/lib/blockchain/minimal-wagmi-config'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'

/**
 * Wagmi + React Query without RainbowKit/Privy.
 * Required so shared layout hooks (useAccount, useConfig) work in AA auth mode.
 */
export function MinimalWagmiProviders({ children }: { children: ReactNode }) {
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
    <WagmiProvider config={minimalWagmiConfig}>
      <WagmiConfigSync />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
