'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type State } from 'wagmi'
import { AaRainbowKitWagmiProvider } from '@/lib/AaRainbowKitWagmiProvider'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { useState, type ReactNode } from 'react'
import { aaWagmiChains } from '@/lib/blockchain/aa-wagmi-chains'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { WalletConnectRelayRecovery } from '@/hooks/useWalletConnectRelayRecovery'
import { CustomAvatar } from '@/components/wallet/CustomAvatar'
import '@rainbow-me/rainbowkit/styles.css'

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
  const initialChainId = aaWagmiChains[0].id
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

  const rkTheme = darkTheme({
    accentColor: '#4ADE80',
    accentColorForeground: '#0a0a0a',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  })

  return (
    <AaRainbowKitWagmiProvider initialState={initialState}>
      <WagmiConfigSync />
      <WalletConnectRelayRecovery />
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rkTheme}
          modalSize="compact"
          initialChain={initialChainId}
          avatar={CustomAvatar}
          appInfo={{
            appName: 'DeCleanup Rewards',
            learnMoreUrl: 'https://decleanup.net',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </AaRainbowKitWagmiProvider>
  )
}
