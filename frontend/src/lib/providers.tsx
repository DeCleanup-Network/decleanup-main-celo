'use client'

import { lazy, Suspense } from 'react'
import { AaSessionProvider } from '@/lib/auth/AaSessionProvider'
import { MinimalWagmiProviders } from '@/lib/MinimalWagmiProviders'
import { WalletProvider } from '@/providers/WalletProvider'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { PrivyProviders } from './privy/PrivyProviders'

const RainbowKitProviders = lazy(
  () => import('./RainbowKitProviders').then((m) => ({ default: m.RainbowKitProviders }))
)

function ProvidersFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" />
    </div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (isAaAuthEnabledClient()) {
    return (
      <MinimalWagmiProviders>
        <AaSessionProvider>
          <WalletProvider>{children}</WalletProvider>
        </AaSessionProvider>
      </MinimalWagmiProviders>
    )
  }

  const isPrivyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

  if (isPrivyEnabled) {
    return <PrivyProviders>{children}</PrivyProviders>
  }

  return (
    <Suspense fallback={<ProvidersFallback />}>
      <RainbowKitProviders>{children}</RainbowKitProviders>
    </Suspense>
  )
}
