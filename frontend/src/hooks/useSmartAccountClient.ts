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
import { isWeb3AuthEnabled } from '@/lib/web3auth/config'
import { connectorLooksLikeExternalOwnedWallet } from '@/lib/blockchain/wallet-provider-kind'

type EmbeddedPath = 'unset' | 'yes' | 'no'

/**
 * Smart account + Pimlico paymaster only when:
 * - Pimlico is configured,
 * - App uses Web3Auth (RainbowKit users always pay their own gas),
 * - User is on Celo Sepolia,
 * - Connected wallet looks like Web3Auth embedded (social/email), not MetaMask / WalletConnect inside the modal.
 *
 * External wallets pay gas via normal `writeContract` (EOA). Embedded wallets use sponsored UserOps.
 *
 * `submissionOwnerAddress` — Safe when sponsored, else wagmi `address` (EOA).
 */
export function useSmartAccountClient(): {
  client: unknown | null
  smartAccountAddress: Address | null
  submissionOwnerAddress: Address | undefined
  isLoading: boolean
  error: Error | null
  /** True only when we intend to submit via paymaster / SC (embedded login). */
  expectsSponsoredGas: boolean
} {
  const { address, isConnected, connector } = useAccount()
  const chainId = useResolvedChainId()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<unknown | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null)
  const [scLoading, setScLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [embeddedPath, setEmbeddedPath] = useState<EmbeddedPath>(() =>
    !isPaymasterConfigured() || !isWeb3AuthEnabled ? 'no' : 'unset'
  )

  useEffect(() => {
    if (!isPaymasterConfigured() || !isWeb3AuthEnabled) {
      setEmbeddedPath('no')
      return
    }
    if (!isConnected || !connector || chainId !== REQUIRED_CHAIN_ID) {
      setEmbeddedPath('unset')
      return
    }

    let cancelled = false
    setEmbeddedPath('unset')

    void connectorLooksLikeExternalOwnedWallet(connector).then((external) => {
      if (cancelled) return
      setEmbeddedPath(external ? 'no' : 'yes')
    })

    return () => {
      cancelled = true
    }
  }, [isConnected, connector, chainId])

  useEffect(() => {
    if (embeddedPath !== 'yes') {
      setClient(null)
      setSmartAccountAddress(null)
      setError(null)
      setScLoading(false)
    }
  }, [embeddedPath])

  useEffect(() => {
    if (embeddedPath !== 'yes') return
    if (!isConnected || !address || chainId !== REQUIRED_CHAIN_ID || !walletClient?.account?.address) {
      setClient(null)
      setSmartAccountAddress(null)
      setError(null)
      return
    }

    let cancelled = false
    setError(null)
    setScLoading(true)
    setClient(null)
    setSmartAccountAddress(null)

    void (async () => {
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
        if (!cancelled) setScLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [embeddedPath, isConnected, address, chainId, walletClient])

  const expectsSponsoredGas = embeddedPath === 'yes'

  const detectingEmbedded = embeddedPath === 'unset' && isPaymasterConfigured() && isWeb3AuthEnabled

  const submissionOwnerAddress = useMemo(() => {
    if (!address) return undefined
    if (!isConnected || chainId !== REQUIRED_CHAIN_ID) return undefined
    if (!walletClient?.account?.address) return undefined

    if (!isPaymasterConfigured() || !isWeb3AuthEnabled || embeddedPath === 'no') {
      return address as Address
    }

    if (embeddedPath !== 'yes') return undefined

    if (!client && !error) return undefined
    return (smartAccountAddress ?? address) as Address
  }, [
    address,
    isConnected,
    chainId,
    walletClient,
    embeddedPath,
    client,
    error,
    smartAccountAddress,
  ])

  return {
    client,
    smartAccountAddress,
    submissionOwnerAddress,
    isLoading: detectingEmbedded || (expectsSponsoredGas && scLoading),
    error,
    expectsSponsoredGas,
  }
}
