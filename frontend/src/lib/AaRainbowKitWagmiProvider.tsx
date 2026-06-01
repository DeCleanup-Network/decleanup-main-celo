'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { WagmiProvider, type State } from 'wagmi'
import type { Config } from 'wagmi'
import { getAaWagmiCookieConfigSingleton } from '@/lib/blockchain/aa-wagmi-cookie-config'
/**
 * Upgrades to RainbowKit getDefaultConfig after mount so mobile/desktop wallet lists work,
 * without importing RainbowKit during Next.js server page collection.
 */
export function AaRainbowKitWagmiProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [config, setConfig] = useState<Config>(() => getAaWagmiCookieConfigSingleton())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void import('@/lib/blockchain/aa-wagmi-config').then(({ getAaRainbowKitConfig }) => {
      setConfig(getAaRainbowKitConfig())
      setReady(true)
    })
  }, [])

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount key={ready ? 'rk' : 'cookie'}>
      {children}
    </WagmiProvider>
  )
}
