'use client'

import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import { useWeb3Auth } from '@web3auth/modal/react'
import { isWeb3AuthEnabled } from '@/lib/web3auth/config'

type Eip1193Provider = {
  request: (args: { method: string }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  off?: (event: string, listener: (...args: unknown[]) => void) => void
}

/**
 * For Web3Auth, wagmi chain state can be stale after connect/switch.
 * Use provider eth_chainId as source of truth.
 */
export function useResolvedChainId(): number | undefined {
  const wagmiChainId = useChainId()
  const { provider } = useWeb3Auth()
  const [providerChainId, setProviderChainId] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!isWeb3AuthEnabled || !provider) {
      setProviderChainId(undefined)
      return
    }

    const p = provider as Eip1193Provider

    const refresh = async () => {
      try {
        const hex = await p.request({ method: 'eth_chainId' })
        if (typeof hex === 'string') {
          const parsed = parseInt(hex, 16)
          if (Number.isFinite(parsed)) setProviderChainId(parsed)
        }
      } catch {
        // ignore
      }
    }

    void refresh()
    const onChainChanged = (...args: unknown[]) => {
      const hex = typeof args[0] === 'string' ? args[0] : ''
      if (!hex) return
      const parsed = parseInt(hex, 16)
      if (Number.isFinite(parsed)) setProviderChainId(parsed)
    }
    p.on?.('chainChanged', onChainChanged)

    return () => {
      p.removeListener?.('chainChanged', onChainChanged)
      p.off?.('chainChanged', onChainChanged)
    }
  }, [provider])

  if (!isWeb3AuthEnabled) return wagmiChainId
  // Until Web3Auth provider responds, fall back to wagmi so eligibility / chain checks aren't `undefined`.
  return providerChainId ?? wagmiChainId
}
