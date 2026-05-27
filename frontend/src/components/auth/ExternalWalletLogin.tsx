'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAccount, useConnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { ensureRequiredChain } from '@/lib/blockchain/ensure-required-chain'
import { useClientMounted } from '@/hooks/useClientMounted'

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

const CONNECT_TIMEOUT_MS = 45_000

/**
 * MetaMask / browser wallet — same wagmi tree as the rest of the app (no nested RainbowKit provider).
 * On mobile Safari without an injected wallet, use WalletConnect instead of injected() (avoids
 * "Provider not found" from @wagmi/core).
 *
 * Do not pass chainId to WalletConnect connect — it blocks on an in-connect network switch and
 * leaves the button stuck on "Connecting…" until the wallet app approves Celo.
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const { status } = useSession()
  const { isConnected } = useAccount()
  const { connect, connectors, isPending, error, reset } = useConnect()
  const target = safeCallbackUrl(callbackUrl)
  const mounted = useClientMounted()
  const [timedOut, setTimedOut] = useState(false)
  const redirectedRef = useRef(false)

  const { injectedConnector, walletConnectConnector } = useMemo(() => {
    const injected =
      connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? null
    const walletConnect = connectors.find((c) => c.id === 'walletConnect') ?? null
    return { injectedConnector: injected, walletConnectConnector: walletConnect }
  }, [connectors])

  useEffect(() => {
    if (!isPending) {
      setTimedOut(false)
      return
    }
    const id = window.setTimeout(() => {
      reset()
      setTimedOut(true)
    }, CONNECT_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [isPending, reset])

  useEffect(() => {
    if (!isConnected || redirectedRef.current) return
    redirectedRef.current = true
    let cancelled = false
    void (async () => {
      if (status === 'authenticated') {
        await signOut({ redirect: false })
      }
      if (!cancelled) router.replace(target)
      // Switch after navigation — do not block connect UI on chain switch.
      void ensureRequiredChain().catch((e) => {
        console.warn('[ExternalWalletLogin] Network switch skipped or failed:', e)
      })
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, status, router, target])

  useEffect(() => {
    if (!isConnected) redirectedRef.current = false
  }, [isConnected])

  const connectWith = (connector: (typeof connectors)[number] | null) => {
    if (!connector) return
    setTimedOut(false)
    reset()
    connect({ connector })
  }

  const showInjected = hasInjectedProvider() && injectedConnector
  const showWalletConnect = walletConnectConnector

  return (
    <div className="space-y-2">
      {!mounted ? (
        <Button
          type="button"
          disabled
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:opacity-50"
        >
          Connect wallet
        </Button>
      ) : isConnected ? (
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
          {isPending && !timedOut ? (
            <p className="text-center text-xs text-gray-400">
              Approve the connection in your wallet app (Rainbow, Zerion, MetaMask).
            </p>
          ) : null}
          {timedOut ? (
            <p className="text-center text-xs text-amber-300" role="alert">
              Connection timed out. Open your wallet app, approve the request, or tap Connect again.
            </p>
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
