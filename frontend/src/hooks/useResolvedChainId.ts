'use client'

import { useEffect, useState } from 'react'
import { useChainId, useWalletClient } from 'wagmi'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

const isPrivyEnabled = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

/**
 * Read `eth_chainId` from the active wagmi WalletClient.
 * Do not use `usePrivy()` here — that hook requires PrivyProvider; builds without
 * NEXT_PUBLIC_PRIVY_APP_ID use RainbowKit only and would crash during SSG.
 */
export function useResolvedChainId(): number | undefined {
  const aa = isAaAuthEnabledClient()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const wagmiChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [rpcChainId, setRpcChainId] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!isPrivyEnabled || !walletClient) {
      setRpcChainId(undefined)
      return
    }

    let cancelled = false
    const refresh = async () => {
      try {
        const hex = await walletClient.request({ method: 'eth_chainId' })
        if (cancelled) return
        if (typeof hex === 'string') {
          const parsed = parseInt(hex, 16)
          if (Number.isFinite(parsed)) setRpcChainId(parsed)
        }
      } catch {
        // ignore
      }
    }

    void refresh()

    const w =
      typeof window !== 'undefined'
        ? (window as Window & {
            ethereum?: { on?: (e: string, cb: (h: string) => void) => void; removeListener?: (e: string, cb: (h: string) => void) => void }
          }).ethereum
        : undefined
    const onChainChanged = (hex: string) => {
      const parsed = parseInt(hex, 16)
      if (Number.isFinite(parsed)) setRpcChainId(parsed)
    }
    w?.on?.('chainChanged', onChainChanged)

    return () => {
      cancelled = true
      w?.removeListener?.('chainChanged', onChainChanged)
    }
  }, [walletClient])

  // Google/email smart accounts use app RPC — not wagmi's connected chain.
  if (aa && isEmbeddedAccount) return REQUIRED_CHAIN_ID

  if (!isPrivyEnabled) return wagmiChainId
  return rpcChainId ?? wagmiChainId
}
