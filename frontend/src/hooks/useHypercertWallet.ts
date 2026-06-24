'use client'

import { useCallback, useMemo } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import type { Address, Hex } from 'viem'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useWallet } from '@/providers/WalletProvider'

/**
 * Hypercerts identity: always the public EOA (MetaMask-importable).
 * Eligibility reads verified cleanups from the Safe when the user is embedded.
 */
export function useHypercertWallet() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { signMessageAsync: wagmiSignMessageAsync } = useSignMessage()
  const {
    address: appAddress,
    isEmbeddedAccount,
    embeddedSponsoredSubmit,
    wagmiConnected: appWagmiConnected,
  } = useAppWalletAddress()
  const { publicWalletAddress, submissionOwnerAddress } = useSmartAccountClient()
  const { signMessageAsEoa, hasActiveSigningSession } = useWallet()

  const eoaAddress = useMemo((): Address | undefined => {
    if (wagmiConnected && wagmiAddress) return wagmiAddress as Address
    if (publicWalletAddress) return publicWalletAddress
    if (appAddress) return appAddress
    return undefined
  }, [wagmiConnected, wagmiAddress, publicWalletAddress, appAddress])

  const eligibilityAddress = submissionOwnerAddress

  const canSignMessages = Boolean(
    (wagmiConnected && wagmiSignMessageAsync) ||
      (isEmbeddedAccount && hasActiveSigningSession && signMessageAsEoa)
  )

  const signMessageAsync = useCallback(
    async (message: string): Promise<Hex> => {
      if (isEmbeddedAccount && hasActiveSigningSession && signMessageAsEoa) {
        return signMessageAsEoa(message)
      }
      if (wagmiConnected && wagmiSignMessageAsync) {
        return wagmiSignMessageAsync({ message })
      }
      throw new Error(
        isEmbeddedAccount
          ? 'Unlock your wallet in Account settings to sign Hypercert requests.'
          : 'Connect your wallet to sign Hypercert requests.'
      )
    },
    [
      isEmbeddedAccount,
      hasActiveSigningSession,
      signMessageAsEoa,
      wagmiConnected,
      wagmiSignMessageAsync,
    ]
  )

  const needsUnlock =
    isEmbeddedAccount && embeddedSponsoredSubmit && !canSignMessages && Boolean(eoaAddress)

  return {
    eoaAddress,
    eligibilityAddress,
    canSignMessages,
    needsUnlock,
    isEmbeddedAccount,
    signMessageAsync,
    usesExternalWallet: appWagmiConnected && !isEmbeddedAccount,
  }
}
