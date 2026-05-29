'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAccount, useConfig } from 'wagmi'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { lockedSwitchToRequiredChain } from '@/lib/blockchain/wallet-write-mutex'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'

/** After WalletConnect / MetaMask connect, prompt switch off Ethereum mainnet once. */
export function useAutoSwitchToAppChain() {
  const pathname = usePathname()
  const config = useConfig()
  const { isConnected, chainId } = useAccount()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (pathname === '/login') {
      attemptedRef.current = false
      return
    }
    if (isEmbeddedAccount || !isConnected || chainId === REQUIRED_CHAIN_ID) {
      attemptedRef.current = false
      return
    }
    if (attemptedRef.current) return
    attemptedRef.current = true

    void lockedSwitchToRequiredChain(config).catch(() => {
      attemptedRef.current = false
    })
  }, [pathname, isEmbeddedAccount, isConnected, chainId, config])
}
