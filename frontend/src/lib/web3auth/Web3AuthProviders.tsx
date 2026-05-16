'use client'

import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Web3AuthProvider } from '@web3auth/modal/react'
import { WagmiProvider } from '@web3auth/modal/react/wagmi'
import {
  createWeb3AuthContextConfig,
  web3AuthClientId,
  web3AuthSapphireNetwork,
} from './config'
import { isWeb3AuthPopupClosedError } from './errors'
import { checkWeb3AuthWalletServicesAccess } from './feature-access'
import {
  clearWeb3AuthStorageAndRedirect,
  extractWeb3AuthErrorMessage,
  isSessionExpiredError,
} from './storage'
import { Web3AuthFeatureContext } from './Web3AuthFeatureContext'
import { WagmiConfigSync } from '@/lib/blockchain/WagmiConfigSync'

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
      const message = extractWeb3AuthErrorMessage(event.reason)
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

function Web3AuthProvidersFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" />
    </div>
  )
}

export function Web3AuthProviders({ children }: { children: React.ReactNode }) {
  const [probeComplete, setProbeComplete] = useState(false)
  const [socialLoginEnabled, setSocialLoginEnabled] = useState(true)

  useEffect(() => {
    if (!web3AuthClientId) {
      setSocialLoginEnabled(false)
      setProbeComplete(true)
      return
    }

    let cancelled = false
    void checkWeb3AuthWalletServicesAccess({
      clientId: web3AuthClientId,
      network: web3AuthSapphireNetwork,
    }).then((result) => {
      if (cancelled) return
      setSocialLoginEnabled(result === 'ok')
      setProbeComplete(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const config = useMemo(
    () => createWeb3AuthContextConfig(socialLoginEnabled),
    [socialLoginEnabled]
  )

  const featureState = useMemo(
    () => ({
      socialLoginEnabled,
      walletServicesForbidden: probeComplete && !socialLoginEnabled,
      probeComplete,
    }),
    [socialLoginEnabled, probeComplete]
  )

  if (!probeComplete) {
    return <Web3AuthProvidersFallback />
  }

  return (
    <Web3AuthFeatureContext.Provider value={featureState}>
      <Web3AuthProvider config={config}>
        <Web3AuthGlobalErrorHandlers />
        <QueryClientProvider client={queryClient}>
          <WagmiProvider>
            <WagmiConfigSync />
            {children}
          </WagmiProvider>
        </QueryClientProvider>
      </Web3AuthProvider>
    </Web3AuthFeatureContext.Provider>
  )
}
