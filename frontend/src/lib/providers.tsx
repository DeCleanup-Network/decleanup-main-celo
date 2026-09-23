'use client'

import { lazy, Suspense } from 'react'
import type { State } from 'wagmi'
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

export function Providers({
  children,
  wagmiInitialState,
}: {
  children: React.ReactNode
  wagmiInitialState?: State
}) {
  // SessionProvider must wrap every path: Header/NotificationBell and
  // useAutoSwitchToAppChain call useSession(). Without it, Vercel SSG of
  // `/_not-found` throws "Cannot destructure property 'data'".
  const inner = isAaAuthEnabledClient() ? (
    <MinimalWagmiProviders initialState={wagmiInitialState}>
      <WalletProvider>{children}</WalletProvider>
    </MinimalWagmiProviders>
  ) : process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <PrivyProviders>{children}</PrivyProviders>
  ) : (
    <Suspense fallback={<ProvidersFallback />}>
      <RainbowKitProviders>{children}</RainbowKitProviders>
    </Suspense>
  )

  return <AaSessionProvider>{inner}</AaSessionProvider>
}
