'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
      <Button
        type="button"
        disabled
        aria-busy="true"
        aria-label="Loading wallet"
        className="min-w-[8.75rem] bg-brand-green text-black hover:bg-brand-green/90 disabled:!opacity-100 disabled:bg-brand-green/65 disabled:text-black"
      >
        Loading…
      </Button>
    )
  }

  if (isWeb3AuthEnabled) {
    return <EmbeddedWalletConnect />
  }

  return (
    <Suspense
      fallback={
        <Button
          type="button"
          disabled
          aria-busy="true"
          aria-label="Loading wallet"
          className="min-w-[8.75rem] bg-brand-green text-black hover:bg-brand-green/90 disabled:!opacity-100 disabled:bg-brand-green/65 disabled:text-black"
        >
          Loading…
        </Button>
      }
    >
      <RainbowKitConnectButton />
    </Suspense>
  )
}
