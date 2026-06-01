'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAccount, useConnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'
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
 * MetaMask / WalletConnect login (pre–RainbowKit AA path).
 * Desktop WC: QR modal + Celo chainId. Mobile WC: deep-link without AppKit bottom sheet.
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

    const isWalletConnect = connector.id === 'walletConnect'
    const mobile = isMobileBrowser()

    if (isWalletConnect && mobile) {
      connect({ connector })
      return
    }

    connect({ connector, chainId: REQUIRED_CHAIN_ID })
  }

  const showInjected = hasInjectedProvider() && injectedConnector
  const showWalletConnect = walletConnectConnector

  return (
    <div className="space-y-2">
      {!mounted ? (
        <Button type="button" disabled className="w-full">
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
              className="w-full"
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
              className="w-full"
              onClick={() => connectWith(walletConnectConnector)}
            >
              {isPending ? 'Connecting…' : showInjected ? 'WalletConnect' : 'Connect wallet'}
            </Button>
          ) : null}
          {!showInjected && !showWalletConnect ? (
            <p className="text-center text-xs text-amber-300">No wallet connectors available.</p>
          ) : null}
          {isPending && !timedOut ? (
            <p className="text-center text-xs text-gray-400">
              {isMobileBrowser()
                ? 'Opening your wallet app… approve the connection there, then return here.'
                : 'Choose a wallet in the modal, or approve the connection in your wallet app.'}
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
