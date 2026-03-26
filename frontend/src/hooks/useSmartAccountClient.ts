'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import type { Address } from 'viem'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import {
  isPaymasterConfigured,
  createSmartAccountClientCeloSepolia,
  getSmartAccountAddressFromClient,
} from '@/lib/blockchain/smart-account'
import { walletClientToAccount } from '@/lib/blockchain/wallet-client-to-account'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'

/**
 * Returns a smart account client for Celo Sepolia with Pimlico paymaster when:
 * - Pimlico API key is set,
 * - Wallet is connected and on Celo Sepolia,
 * - WalletClient is available (e.g. Web3Auth embedded wallet).
 * Otherwise returns null; use EOA path (writeContract) as fallback.
 *
 * `submissionOwnerAddress` is the address submissions / rewards use onchain (Safe when gasless, else EOA).
 */
export function useSmartAccountClient(): {
  client: unknown | null
  smartAccountAddress: Address | null
  /** Use Submission.sol / reward reads with this address (not necessarily the connected EOA). */
  submissionOwnerAddress: Address | undefined
  isLoading: boolean
  error: Error | null
} {
  const { address, isConnected } = useAccount()
  const chainId = useResolvedChainId()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<unknown | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submissionOwnerAddress = useMemo(
    () => (address ? (smartAccountAddress ?? address) : undefined),
    [address, smartAccountAddress]
  )

  useEffect(() => {
    if (
      !isPaymasterConfigured() ||
      !isConnected ||
      !address ||
      chainId !== REQUIRED_CHAIN_ID ||
      !walletClient?.account?.address
    ) {
      setClient(null)
      setSmartAccountAddress(null)
      setError(null)
      return
    }

    let cancelled = false
    setError(null)
    setIsLoading(true)

    ;(async () => {
      try {
        const account = walletClientToAccount(walletClient)
        const smartClient = await createSmartAccountClientCeloSepolia(account)
        if (!cancelled) {
          setClient(smartClient)
          setSmartAccountAddress(getSmartAccountAddressFromClient(smartClient))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
          setClient(null)
          setSmartAccountAddress(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isConnected, address, chainId, walletClient])

  return { client, smartAccountAddress, submissionOwnerAddress, isLoading, error }
}
