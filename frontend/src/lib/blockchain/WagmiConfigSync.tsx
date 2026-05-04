'use client'

import { useConfig } from 'wagmi'
import { setWagmiConfig } from './get-wagmi-config'

/**
 * Syncs the active WagmiProvider config into get-wagmi-config so contract helpers
 * (contracts.ts) can use getConfig() without importing wagmi.ts.
 * Mount once inside each provider tree (Web3Auth and RainbowKit).
 *
 * Updates synchronously during render so getConfig() is valid before child useEffects
 * run (e.g. leaderboard). A deferred effect + cleanup(null) races Strict Mode and can
 * clear config while async contract reads are still in flight.
 */
export function WagmiConfigSync() {
  const config = useConfig()
  setWagmiConfig(config)
  return null
}
