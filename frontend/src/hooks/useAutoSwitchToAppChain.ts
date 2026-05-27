'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useConfig } from 'wagmi'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'

/** After WalletConnect / MetaMask connect, prompt switch off Ethereum mainnet once. */
export function useAutoSwitchToAppChain() {
  const config = useConfig()
  const { isConnected, chainId } = useAccount()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (isEmbeddedAccount || !isConnected || chainId === REQUIRED_CHAIN_ID) {
      attemptedRef.current = false
      return
    }
    if (attemptedRef.current) return
    attemptedRef.current = true

    void switchToRequiredChain(config).catch(() => {
      attemptedRef.current = false
    })
  }, [isEmbeddedAccount, isConnected, chainId, config])
}
