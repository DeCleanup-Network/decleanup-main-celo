'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type State } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { useState } from 'react'
import { config } from './blockchain/wagmi'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { CustomAvatar } from '@/components/wallet/CustomAvatar'
import { WalletConnectRelayRecovery } from '@/hooks/useWalletConnectRelayRecovery'
import '@rainbow-me/rainbowkit/styles.css'

const APP_NAME = 'DeCleanup Rewards'

export function RainbowKitProviders({
  children,
  initialState,
}: {
  children: React.ReactNode
  initialState?: State
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount: number, error: unknown) => {
              const msg = error instanceof Error ? error.message : String(error)
              if (msg.includes('CORS') || msg.includes('Access-Control-Allow-Origin')) return false
              return failureCount < 2
            },
          },
        },
      })
  )

  const customTheme = darkTheme({
    accentColor: '#58b12f',
    accentColorForeground: 'black',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  })

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount>
      <WagmiConfigSync />
      <WalletConnectRelayRecovery />
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={customTheme}
          modalSize="compact"
          coolMode
          avatar={CustomAvatar}
          appInfo={{
            appName: APP_NAME,
            learnMoreUrl: 'https://decleanup.net',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
