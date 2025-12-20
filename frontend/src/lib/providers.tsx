'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from './blockchain/wagmi'
import { CustomAvatar } from '@/components/wallet/CustomAvatar'
import { useState } from 'react'
import '@rainbow-me/rainbowkit/styles.css'

const APP_NAME = 'DeCleanup Rewards'
const APP_DESCRIPTION = 'Clean up, share proof, and earn tokenized environmental rewards on Celo.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_MINIAPP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafybeiatsp354gtary234ie6irpa5x56q3maykjynkbe3f2hj6lq7pbvba?filename=icon.png'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              // Don't retry on CORS errors (they won't succeed)
              if (error?.message?.includes('CORS') || error?.message?.includes('Access-Control-Allow-Origin')) {
                return false
              }
              return failureCount < 2
            },
            onError: (error: any) => {
              // Suppress CORS errors in console (they're expected for ENS avatar fetching)
              if (!error?.message?.includes('CORS') && !error?.message?.includes('Access-Control-Allow-Origin')) {
                console.error('Query error:', error)
              }
            },
          },
        },
      })
  )

  // Enhanced theme customization
  // RainbowKit's darkTheme accepts accentColor, accentColorForeground, borderRadius, fontStack, overlayBlur
  // Additional customization can be done via CSS variables if needed
  const customTheme = darkTheme({
    accentColor: '#58B12F', // brand-green
    accentColorForeground: 'black',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  })

  return (
    <WagmiProvider config={config}>
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

