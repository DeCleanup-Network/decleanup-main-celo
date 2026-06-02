'use client'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { useWalletConnectionMode } from '@/hooks/useWalletConnectionMode'
import { EmbeddedWalletConnect } from './EmbeddedWalletConnect'

const RainbowKitConnectButton = lazy(
  () =>
    import('./RainbowKitConnectButton').then((m) => ({ default: m.RainbowKitConnectButton }))
)

function ConnectLoadingButton() {
  return (
    <Button type="button" disabled aria-busy="true" aria-label="Loading wallet" className="min-w-[8.75rem]">
      Loading…
    </Button>
  )
}

function ConnectErrorFallback() {
  return null
}

class ConnectLazyBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return <ConnectErrorFallback />
    return this.props.children
  }
}

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const aa = isAaAuthEnabledClient()
  const { showSmartAccountSettings, showWalletSettings } = useWalletConnectionMode()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  if (aa) {
    if (showSmartAccountSettings || showWalletSettings) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {showSmartAccountSettings && (
            <Button asChild variant="brandGhost" size="sm">
              <Link href="/wallet">Account settings</Link>
            </Button>
          )}
          {showWalletSettings && (
            <Button asChild variant="brandGhost" size="sm">
              <Link href="/wallet/external">Wallet settings</Link>
            </Button>
          )}
        </div>
      )
    }
    return null
  }

  const isPrivyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

  if (isPrivyEnabled) {
    return <EmbeddedWalletConnect />
  }

  const connectButton = (
    <ConnectLazyBoundary>
      <Suspense fallback={<ConnectLoadingButton />}>
        <RainbowKitConnectButton />
      </Suspense>
    </ConnectLazyBoundary>
  )

  if (showWalletSettings) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="brandGhost" size="sm">
          <Link href="/wallet/external">Wallet settings</Link>
        </Button>
        {connectButton}
      </div>
    )
  }

  return connectButton
}
