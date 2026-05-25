'use client'

import { useCallback } from 'react'
import { signOut } from 'next-auth/react'
import { useDisconnect } from 'wagmi'

type SignOutAllOptions = {
  callbackUrl?: string
  redirect?: boolean
}

/** Clears Auth.js session and disconnects wagmi (MetaMask, etc.). One sign-in method at a time. */
export function useSignOutAll() {
  const { disconnect, isPending: disconnecting } = useDisconnect()

  const signOutAll = useCallback(
    async ({ callbackUrl = '/login', redirect = true }: SignOutAllOptions = {}) => {
      disconnect()
      await signOut({ callbackUrl, redirect })
    },
    [disconnect]
  )

  return { signOutAll, disconnecting }
}
