'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAccount, useConnect } from 'wagmi'
import { Button } from '@/components/ui/button'

type Props = {
  callbackUrl: string
}

function safeCallbackUrl(url: string): string {
  if (!url || url.startsWith('/login')) return '/'
  return url
}

function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as Window & { ethereum?: unknown }).ethereum)
}

/**
 * MetaMask / browser wallet — same wagmi tree as the rest of the app (no nested RainbowKit provider).
 * On mobile Safari without an injected wallet, use WalletConnect instead of injected() (avoids
 * "Provider not found" from @wagmi/core).
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const { status } = useSession()
  const { isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const target = safeCallbackUrl(callbackUrl)

  const { injectedConnector, walletConnectConnector } = useMemo(() => {
    const injected =
      connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? null
    const walletConnect = connectors.find((c) => c.id === 'walletConnect') ?? null
    return { injectedConnector: injected, walletConnectConnector: walletConnect }
  }, [connectors])

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    void (async () => {
      if (status === 'authenticated') {
        await signOut({ redirect: false })
      }
      if (!cancelled) router.replace(target)
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, status, router, target])

  const connectWith = (connector: (typeof connectors)[number] | null) => {
    if (!connector) return
    connect({ connector })
  }

  const showInjected = hasInjectedProvider() && injectedConnector
  const showWalletConnect = walletConnectConnector

  return (
    <div className="space-y-2">
      {isConnected ? (
        <p className="text-center text-xs text-brand-green">Connected — opening app…</p>
      ) : (
        <>
          {showInjected ? (
            <Button
              type="button"
              disabled={isPending}
              className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:opacity-50"
              onClick={() => connectWith(injectedConnector)}
            >
              {isPending ? 'Connecting…' : 'MetaMask / browser wallet'}
            </Button>
          ) : null}
          {showWalletConnect ? (
            <Button
              type="button"
              variant={showInjected ? 'outline' : 'default'}
              disabled={isPending}
              className={
                showInjected
                  ? 'w-full border-gray-600 text-gray-200'
                  : 'w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:opacity-50'
              }
              onClick={() => connectWith(walletConnectConnector)}
            >
              {isPending ? 'Connecting…' : showInjected ? 'WalletConnect (mobile)' : 'Connect wallet'}
            </Button>
          ) : null}
          {!showInjected && !showWalletConnect ? (
            <p className="text-center text-xs text-amber-300">No wallet connectors available.</p>
          ) : null}
          {error ? (
            <p className="text-center text-xs text-amber-300" role="alert">
              {error.message}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
