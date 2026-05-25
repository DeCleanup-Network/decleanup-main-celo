'use client'

import { useSession } from 'next-auth/react'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { isEmbeddedAuthProvider } from '@/lib/auth/embedded-auth'

/**
 * Google / email → embedded smart account. MetaMask-only → wagmi, no WalletProvider bootstrap.
 */
export function useEmbeddedAuth() {
  const aaEnabled = isAaAuthEnabledClient()
  const { data: session, status } = useSession()
  const authProvider = session?.authProvider

  const isAuthenticated = aaEnabled && status === 'authenticated'
  const isEmbeddedAccount = isAuthenticated && isEmbeddedAuthProvider(authProvider)

  return {
    aaEnabled,
    status,
    authProvider,
    isAuthenticated,
    isEmbeddedAccount,
  }
}
