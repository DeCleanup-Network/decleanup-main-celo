'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { celo, celoSepolia } from 'viem/chains'

const queryClient = new QueryClient()

const activeChain = REQUIRED_CHAIN_ID === 42220 ? celo : celoSepolia

export function PrivyProviders({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''

  if (!appId) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID is not set. Privy will not work correctly.')
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'twitter', 'apple', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#45D391', // DeCleanup green
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: activeChain,
        supportedChains: [celo, celoSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <WagmiConfigSync />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
