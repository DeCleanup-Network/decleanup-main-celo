'use client'

import { useAccount } from 'wagmi'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'

/**
 * Embedded smart account = Google or email sign-in (WalletProvider).
 * External wallet = MetaMask / RainbowKit without embedded account session.
 */
export function useWalletConnectionMode() {
  const { aaEnabled, isAuthenticated, isEmbeddedAccount } = useEmbeddedAuth()
  const { isConnected: wagmiConnected } = useAccount()

  const hasExternalWallet = wagmiConnected && !isEmbeddedAccount

  return {
    aaEnabled,
    hasSmartAccountSession: isEmbeddedAccount,
    hasExternalWallet,
    showSmartAccountSettings: isEmbeddedAccount,
    showWalletSettings: hasExternalWallet,
    isAuthenticated,
    isEmbeddedAccount,
  }
}
