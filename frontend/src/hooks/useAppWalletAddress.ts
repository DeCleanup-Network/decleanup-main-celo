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

  const embeddedWalletReady =
    isEmbeddedAccount &&
    (phase === 'pending-password' || phase === 'locked' || phase === 'unlocked' || phase === 'server-only')

  let address: Address | undefined = wagmiConnected ? wagmiAddress : undefined
  if (embeddedWalletReady && eoaAddress) {
    address = eoaAddress
  }

  const isConnected =
    Boolean(address && (wagmiConnected || isEmbeddedAccount)) ||
    Boolean(isEmbeddedAccount && isAuthenticated && smartAccountAddress && phase !== 'no-wallet')
  const canTransact =
    (wagmiConnected && !isEmbeddedAccount) || (isEmbeddedAccount && phase === 'unlocked')

  const walletReady =
    !aaEnabled ||
    !isEmbeddedAccount ||
    (isEmbeddedAccount &&
      (phase === 'pending-password' || phase === 'locked' || phase === 'unlocked'))

  const walletBootstrapping =
    isEmbeddedAccount &&
    ((phase === 'loading' && !smartAccountAddress && !eoaAddress) || phase === 'no-wallet')

  const embeddedSponsoredSubmit =
    aaEnabled && isEmbeddedAccount && isAuthenticated && phase !== 'no-wallet'

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
    embeddedSponsoredSubmit,
    wagmiConnected,
  }
}
