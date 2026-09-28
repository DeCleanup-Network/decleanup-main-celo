'use client'

import { useCallback, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useConfig } from 'wagmi'
import { disconnectAllWallets } from '@/lib/blockchain/wallet-disconnect'
import { useWalletOptional } from '@/providers/WalletProvider'

type SignOutAllOptions = {
  callbackUrl?: string
  redirect?: boolean
}

/** Clears Auth.js session and fully disconnects wagmi so persist cannot bounce the same wallet back. */
export function useSignOutAll() {
  const config = useConfig()
  const wallet = useWalletOptional()
  const [disconnecting, setDisconnecting] = useState(false)

  const signOutAll = useCallback(
    async ({ callbackUrl = '/login', redirect = true }: SignOutAllOptions = {}) => {
      setDisconnecting(true)
      try {
        await disconnectAllWallets(config)
        await wallet?.clearLocalWallet().catch(() => undefined)
        await signOut({ callbackUrl, redirect })
      } finally {
        setDisconnecting(false)
      }
    },
    [config, wallet]
  )

  return { signOutAll, disconnecting }
}
