'use client'

import { lazy, Suspense } from 'react'
import { isWeb3AuthEnabled } from './web3auth/config'
import { Web3AuthProviders } from './web3auth/Web3AuthProviders'

// Load RainbowKit + WalletConnect only when Web3Auth is OFF. This avoids
// "WalletConnect Core is already initialized" and blank popup when using Web3Auth.
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
  if (isWeb3AuthEnabled) {
    return <Web3AuthProviders>{children}</Web3AuthProviders>
  }

  return (
    <Suspense fallback={<ProvidersFallback />}>
      <RainbowKitProviders>{children}</RainbowKitProviders>
    </Suspense>
  )
}
