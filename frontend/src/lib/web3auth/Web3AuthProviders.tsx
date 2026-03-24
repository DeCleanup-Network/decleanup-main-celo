'use client'

import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Web3AuthProvider } from '@web3auth/modal/react'
import { WagmiProvider } from '@web3auth/modal/react/wagmi'
import { web3AuthContextConfig } from './config'
import { isWeb3AuthPopupClosedError } from './errors'
import { clearWeb3AuthStorageAndRedirect, isSessionExpiredError } from './storage'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'

/**
 * Suppress Web3Auth popup-closed (5114) from crashing the Next.js dev overlay; handle session expiry.
 * Uses capture so we run before other listeners. GitHub/X OAuth can reject with odd `reason` shapes.
 */
function Web3AuthGlobalErrorHandlers() {
  useEffect(() => {
    const swallowPopupClosed = (event: PromiseRejectionEvent | ErrorEvent) => {
      const payload =
        event instanceof ErrorEvent ? event.error : (event as PromiseRejectionEvent).reason
      if (!isWeb3AuthPopupClosedError(payload)) return
      event.preventDefault()
      if ('stopImmediatePropagation' in event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isWeb3AuthPopupClosedError(event.reason)) {
        swallowPopupClosed(event)
        return
      }
      const message =
        event?.reason?.message ?? event?.reason?.error?.message ?? String(event?.reason ?? '')
      if (isSessionExpiredError(message)) {
        event.preventDefault?.()
        clearWeb3AuthStorageAndRedirect('/reset-wallet-session')
      }
    }

    const onWindowError = (event: ErrorEvent) => {
      if (isWeb3AuthPopupClosedError(event.error)) {
        swallowPopupClosed(event)
      }
    }

    window.addEventListener('unhandledrejection', onRejection, true)
    window.addEventListener('error', onWindowError, true)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection, true)
      window.removeEventListener('error', onWindowError, true)
    }
  }, [])
  return null
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('CORS') || msg.includes('Access-Control-Allow-Origin')) return false
        return failureCount < 2
      },
    },
  },
})

export function Web3AuthProviders({ children }: { children: React.ReactNode }) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <Web3AuthGlobalErrorHandlers />
      <QueryClientProvider client={queryClient}>
        <WagmiProvider>
          <WagmiConfigSync />
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  )
}
