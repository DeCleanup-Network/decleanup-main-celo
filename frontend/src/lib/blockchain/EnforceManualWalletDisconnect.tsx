'use client'

import { useEffect } from 'react'
import { useConfig } from 'wagmi'
import {
  disconnectAllWallets,
  isManualWalletDisconnectActive,
} from '@/lib/blockchain/wallet-disconnect'

/** If the user signed out, kill any persist/hydration bounce of the same connector. */
export function EnforceManualWalletDisconnect() {
  const config = useConfig()
  useEffect(() => {
    if (!isManualWalletDisconnectActive()) return
    void disconnectAllWallets(config)
  }, [config])
  return null
}
