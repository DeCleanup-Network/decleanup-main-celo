'use client'

import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { useWallet } from '@/providers/WalletProvider'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import type { WalletPhase } from '@/providers/WalletProvider'

/**
 * App wallet: embedded smart account (Google/email) OR external MetaMask (wagmi only).
 */
export function useAppWalletAddress() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { isAuthenticated, isEmbeddedAccount, aaEnabled } = useEmbeddedAuth()
  const { eoaAddress, phase, needsSigningPassword, smartAccountAddress } = useWallet()

  const showMainApp = aaEnabled ? isAuthenticated || wagmiConnected : wagmiConnected

  let address: Address | undefined = wagmiConnected ? wagmiAddress : undefined
  if (
    isEmbeddedAccount &&
    eoaAddress &&
    (phase === 'unlocked' || phase === 'locked' || phase === 'pending-password')
  ) {
    address = eoaAddress
  }

  const isConnected = Boolean(address && (wagmiConnected || isEmbeddedAccount))
  const canTransact =
    (wagmiConnected && !isEmbeddedAccount) || (isEmbeddedAccount && phase === 'unlocked')

  const walletReady =
    !aaEnabled ||
    !isEmbeddedAccount ||
    (isEmbeddedAccount &&
      (phase === 'pending-password' || phase === 'locked' || phase === 'unlocked'))

  const walletBootstrapping =
    isEmbeddedAccount &&
    (phase === 'loading' || phase === 'no-wallet') &&
    !smartAccountAddress

  return {
    address,
    isConnected,
    showMainApp,
    canTransact,
    isAuthenticated,
    isEmbeddedAccount,
    walletPhase: phase as WalletPhase,
    needsSigningPassword,
    aaEnabled,
    walletReady,
    walletBootstrapping,
    wagmiConnected,
  }
}
