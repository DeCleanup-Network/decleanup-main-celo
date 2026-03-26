'use client'

import { useConfig } from 'wagmi'
import { useEffect } from 'react'
import { setWagmiConfig } from './get-wagmi-config'

/**
 * Syncs the active WagmiProvider config into get-wagmi-config so contract helpers
 * (contracts.ts) can use getConfig() without importing wagmi.ts.
 * Mount once inside each provider tree (Web3Auth and RainbowKit).
 */
export function WagmiConfigSync() {
  const config = useConfig()
  useEffect(() => {
    setWagmiConfig(config)
    return () => setWagmiConfig(null)
  }, [config])
  return null
}
