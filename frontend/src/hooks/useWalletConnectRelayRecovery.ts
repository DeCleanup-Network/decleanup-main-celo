'use client'

import { useEffect, useRef } from 'react'
import { disconnect, getAccount, reconnect } from '@wagmi/core'
import { useConfig } from 'wagmi'

function isStaleWalletConnectError(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason)
  return (
    msg.includes('No matching key') ||
    msg.includes('session topic doesn') ||
    msg.includes('session not found') ||
    msg.includes('Pairing not found')
  )
}

/**
 * iOS Safari suspends the WC relay WebSocket when the user opens MetaMask.
 * Reconnect when the tab is visible again; clear corrupt sessions on "No matching key".
 */
export function WalletConnectRelayRecovery() {
  const config = useConfig()
  const recoverInFlight = useRef(false)
  const lastRecoverAt = useRef(0)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const runRecover = async (reason: 'visibility' | 'stale-session') => {
      const account = getAccount(config)
      if (!account.isConnected || account.connector?.id !== 'walletConnect') return

      const now = Date.now()
      if (recoverInFlight.current || now - lastRecoverAt.current < 1500) return
      recoverInFlight.current = true
      lastRecoverAt.current = now

      try {
        await reconnect(config)
        if (process.env.NODE_ENV === 'development') {
          console.log('[WC] relay recovered after', reason)
        }
      } catch (err) {
        if (reason === 'stale-session' || isStaleWalletConnectError(err)) {
          console.warn('[WC] stale session — disconnecting so you can reconnect cleanly')
          try {
            await disconnect(config)
          } catch {
            /* ignore */
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('[WC] relay failed:', err)
        }
      } finally {
        recoverInFlight.current = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void runRecover('visibility')
    }

    const onPageShow = () => void runRecover('visibility')

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleWalletConnectError(event.reason)) return
      const account = getAccount(config)
      if (account.connector?.id !== 'walletConnect') return
      event.preventDefault()
      void runRecover('stale-session')
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [config])

  return null
}
