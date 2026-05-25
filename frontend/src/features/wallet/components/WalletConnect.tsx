'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { useWalletConnectionMode } from '@/hooks/useWalletConnectionMode'
import { EmbeddedWalletConnect } from './EmbeddedWalletConnect'

const RainbowKitConnectButton = lazy(
  () =>
    import('./RainbowKitConnectButton').then((m) => ({ default: m.RainbowKitConnectButton }))
)

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const aa = isAaAuthEnabledClient()
  const { showSmartAccountSettings, showWalletSettings } = useWalletConnectionMode()

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
        className="min-w-[8.75rem] font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:!opacity-100 disabled:bg-brand-green/65 disabled:!text-black"
      >
        Loading…
      </Button>
    )
  }

  if (aa) {
    if (showSmartAccountSettings || showWalletSettings) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {showSmartAccountSettings && (
            <Link
              href="/wallet"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-900"
            >
              Smart account settings
            </Link>
          )}
          {showWalletSettings && (
            <Link
              href="/wallet/external"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-900"
            >
              Wallet settings
            </Link>
          )}
        </div>
      )
    }
    // Home hero has the primary Log in — avoid duplicate in header
    if (pathname === '/') {
      return null
    }
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium !text-black bg-brand-green hover:bg-brand-green/90"
      >
        Log in
      </Link>
    )
  }

  const isPrivyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

  if (isPrivyEnabled) {
    return <EmbeddedWalletConnect />
  }

  if (showWalletSettings) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/wallet/external"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-900"
        >
          Wallet settings
        </Link>
        <Suspense
          fallback={
            <Button
              type="button"
              disabled
              aria-busy="true"
              className="min-w-[8.75rem] font-sans !text-black bg-brand-green hover:bg-brand-green/90"
            >
              Loading…
            </Button>
          }
        >
          <RainbowKitConnectButton />
        </Suspense>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <Button
          type="button"
          disabled
          aria-busy="true"
          aria-label="Loading wallet"
          className="min-w-[8.75rem] font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:!opacity-100 disabled:bg-brand-green/65 disabled:!text-black"
        >
          Loading…
        </Button>
      }
    >
      <RainbowKitConnectButton />
    </Suspense>
  )
}
