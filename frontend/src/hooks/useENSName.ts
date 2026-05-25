'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { resolveAddressToEnsName } from '@/lib/utils/ens'

/**
 * Primary ENS name for an address (Ethereum mainnet reverse record).
 * Resolves via /api/ens/reverse (server-side RPC; avoids CSP blocking browser → mainnet).
 */
export function useENSName(address: Address | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lookupFailed, setLookupFailed] = useState(false)

  useEffect(() => {
    if (!address) {
      setEnsName(null)
      setLookupFailed(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLookupFailed(false)
    setEnsName(null)

    void resolveAddressToEnsName(address)
      .then((name) => {
        if (cancelled) return
        setEnsName(name)
        setLookupFailed(false)
      })
      .catch(() => {
        if (cancelled) return
        setEnsName(null)
        setLookupFailed(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [address])

  return { ensName, isLoading, lookupFailed }
}
