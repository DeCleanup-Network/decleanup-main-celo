'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { isWeb3AuthEnabled } from '@/lib/web3auth/config'
import { EmbeddedWalletConnect } from './EmbeddedWalletConnect'

const RainbowKitConnectButton = lazy(
  () =>
    import('./RainbowKitConnectButton').then((m) => ({ default: m.RainbowKitConnectButton }))
)

/**
 * Unified wallet connect: when Web3Auth is configured, renders EmbeddedWalletConnect
 * (email/Google login). Otherwise lazy-loads RainbowKit ConnectButton so we never
 * load RainbowKit/WalletConnect when Web3Auth is active (avoids init conflicts).
 */
export function WalletConnect() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" />
      </div>
    )
  }

  if (isWeb3AuthEnabled) {
    return <EmbeddedWalletConnect />
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" />
        </div>
      }
    >
      <RainbowKitConnectButton />
    </Suspense>
  )
}
