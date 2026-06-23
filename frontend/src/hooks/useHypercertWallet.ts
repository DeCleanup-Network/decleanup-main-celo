'use client'

import { useCallback, useMemo } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import type { Address, Hex } from 'viem'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useWallet } from '@/providers/WalletProvider'
import { isPaymasterConfigured } from '@/lib/blockchain/smart-account'
import type { MintHypercertOptions } from '@/lib/blockchain/hypercerts/mint-options'

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
    canTransact,
    embeddedSponsoredSubmit,
    wagmiConnected: appWagmiConnected,
  } = useAppWalletAddress()
  const { publicWalletAddress, submissionOwnerAddress, expectsSponsoredGas } = useSmartAccountClient()
  const { signMessageAsEoa, getGaslessClient, writeContractAsEoa, hasActiveSigningSession } = useWallet()

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

  const getMintOptions = useCallback(async (): Promise<MintHypercertOptions> => {
    const base: MintHypercertOptions = {
      submissionOwnerAddress: eligibilityAddress,
    }

    if (isEmbeddedAccount && canTransact) {
      if (expectsSponsoredGas && isPaymasterConfigured()) {
        const gaslessClient = await getGaslessClient()
        if (gaslessClient) {
          return { ...base, gaslessClient }
        }
      }
      return { ...base, embeddedEoaWrite: writeContractAsEoa }
    }

    return base
  }, [
    eligibilityAddress,
    isEmbeddedAccount,
    canTransact,
    expectsSponsoredGas,
    getGaslessClient,
    writeContractAsEoa,
  ])

  const needsUnlock =
    isEmbeddedAccount && embeddedSponsoredSubmit && !canTransact && Boolean(eoaAddress)

  return {
    eoaAddress,
    eligibilityAddress,
    canSignMessages,
    needsUnlock,
    isEmbeddedAccount,
    expectsSponsoredGas: isEmbeddedAccount && expectsSponsoredGas && isPaymasterConfigured(),
    signMessageAsync,
    getMintOptions,
    /** External MetaMask path — no embedded session required for mint if wagmi is connected. */
    usesExternalWallet: appWagmiConnected && !isEmbeddedAccount,
  }
}
