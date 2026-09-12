'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAccount, useConfig, useConnect, useSignMessage } from 'wagmi'
import { reconnect } from '@wagmi/core'
import { Button } from '@/components/ui/button'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'
import { useClientMounted } from '@/hooks/useClientMounted'
import { signInWithConnectedWallet } from '@/lib/auth/client-wallet-signin'

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

const CONNECT_TIMEOUT_MS = 25_000

/**
 * MetaMask / WalletConnect login (pre–RainbowKit AA path).
 * Desktop WC: QR modal + Celo chainId. Mobile WC: deep-link without AppKit bottom sheet.
 * After connect, asks for a one-time signature so notification prefs / inbox work.
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const config = useConfig()
  const { status } = useSession()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { connectAsync, connectors, isPending, error, reset } = useConnect()
  const target = safeCallbackUrl(callbackUrl)
  const mounted = useClientMounted()
  const [timedOut, setTimedOut] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const redirectedRef = useRef(false)

  const { injectedConnector, metaMaskConnector, walletConnectConnector } = useMemo(() => {
    const metaMask =
      connectors.find((c) => c.id === 'metaMask' || c.id === 'metaMaskSDK' || c.type === 'metaMask') ??
      null
    const injected =
      connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? null
    const walletConnect = connectors.find((c) => c.id === 'walletConnect') ?? null
    return {
      injectedConnector: injected,
      metaMaskConnector: metaMask,
      walletConnectConnector: walletConnect,
    }
  }, [connectors])

  useEffect(() => {
    if (!isPending && !connecting) {
      setTimedOut(false)
      return
    }
    const id = window.setTimeout(() => {
      reset()
      setConnecting(false)
      setTimedOut(true)
    }, CONNECT_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [isPending, connecting, reset])

  useEffect(() => {
    if (!isConnected || !address || redirectedRef.current) return
    redirectedRef.current = true
    let cancelled = false
    void (async () => {
      setAuthBusy(true)
      setAuthError(null)
      try {
        if (status === 'authenticated') {
          await signOut({ redirect: false })
        }
        const result = await signInWithConnectedWallet({
          address,
          signMessageAsync,
        })
        if (cancelled) return
        if (!result.ok) {
          setAuthError(result.error)
          redirectedRef.current = false
          return
        }
        router.replace(target)
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : 'Wallet sign-in failed')
          redirectedRef.current = false
        }
      } finally {
        if (!cancelled) setAuthBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, address, status, router, target, signMessageAsync])

  useEffect(() => {
    if (!isConnected) redirectedRef.current = false
  }, [isConnected])

  const connectWith = async (connector: (typeof connectors)[number] | null) => {
    if (!connector) return
    setTimedOut(false)
    setAuthError(null)
    setConnectError(null)
    setConnecting(true)
    reset()

    const isWalletConnect = connector.id === 'walletConnect'
    const mobile = isMobileBrowser()

    try {
      // Mobile only: nudge relay before connect. Desktop reconnect races AppKit QR open.
      if (isWalletConnect && mobile) {
        void reconnect(config).catch(() => {})
      }

      // Avoid chainId on WalletConnect connect — can block QR modal open on some desktops.
      if (isWalletConnect) {
        await connectAsync({ connector })
      } else {
        await connectAsync({ connector, chainId: REQUIRED_CHAIN_ID })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection failed'
      if (/rejected|denied|closed|cancel/i.test(msg)) {
        setConnectError('Connection cancelled. Try again.')
      } else {
        setConnectError(msg)
      }
    } finally {
      setConnecting(false)
    }
  }

  const browserWalletConnector =
    (hasInjectedProvider() && (metaMaskConnector || injectedConnector)) || null
  const showBrowserWallet = Boolean(browserWalletConnector)
  const showWalletConnect = Boolean(walletConnectConnector)
  const busy = isPending || connecting || authBusy

  return (
    <div className="space-y-2">
      {!mounted ? (
        <Button type="button" disabled className="w-full">
          Connect wallet
        </Button>
      ) : isConnected && authBusy ? (
        <p className="text-center text-xs text-brand-green">
          Connected — sign the message in your wallet to finish…
        </p>
      ) : isConnected && !authError ? (
        <p className="text-center text-xs text-brand-green">Connected — opening app…</p>
      ) : (
        <>
          {showBrowserWallet ? (
            <Button
              type="button"
              disabled={busy}
              className="w-full"
              onClick={() => void connectWith(browserWalletConnector)}
            >
              {busy && !authBusy ? 'Connecting…' : 'MetaMask / browser wallet'}
            </Button>
          ) : null}
          {showWalletConnect ? (
            <Button
              type="button"
              variant={showBrowserWallet ? 'outline' : 'default'}
              disabled={busy}
              className="w-full"
              onClick={() => void connectWith(walletConnectConnector)}
            >
              {busy && !authBusy
                ? 'Opening WalletConnect…'
                : showBrowserWallet
                  ? 'WalletConnect'
                  : 'Connect wallet'}
            </Button>
          ) : null}
          {!showBrowserWallet && !showWalletConnect ? (
            <p className="text-center text-xs text-amber-300">No wallet connectors available.</p>
          ) : null}
          {(isPending || connecting) && !timedOut ? (
            <p className="text-center text-xs text-gray-400">
              {isMobileBrowser()
                ? 'Choose your wallet in the popup, or wait to be sent to your wallet app.'
                : 'Choose a wallet in the modal, or approve the connection in your wallet app.'}
            </p>
          ) : null}
          {(isPending || connecting) && !timedOut ? (
            <Button
              type="button"
              variant="brandGhost"
              size="sm"
              className="w-full"
              onClick={() => {
                reset()
                setConnecting(false)
                setTimedOut(false)
              }}
            >
              Cancel
            </Button>
          ) : null}
          {timedOut ? (
            <p className="text-center text-xs text-amber-300" role="alert">
              Connection timed out. Open your wallet app, approve the request, or tap Connect again.
            </p>
          ) : null}
          {connectError ? (
            <p className="text-center text-xs text-amber-300" role="alert">
              {connectError}
            </p>
          ) : null}
          {error ? (
            <p className="text-center text-xs text-amber-300" role="alert">
              {error.message}
            </p>
          ) : null}
          {authError ? (
            <div className="space-y-2">
              <p className="text-center text-xs text-amber-300" role="alert">
                {authError}
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={authBusy || !address}
                onClick={() => {
                  redirectedRef.current = false
                  setAuthError(null)
                  void (async () => {
                    if (!address) return
                    setAuthBusy(true)
                    const result = await signInWithConnectedWallet({
                      address,
                      signMessageAsync,
                    })
                    setAuthBusy(false)
                    if (!result.ok) {
                      setAuthError(result.error)
                      return
                    }
                    router.replace(target)
                  })()
                }}
              >
                Try signature again
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
