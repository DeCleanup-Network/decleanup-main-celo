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
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { useWallet } from '@/providers/WalletProvider'
const isPrivyEnabled = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)
import { connectorLooksLikeExternalOwnedWallet } from '@/lib/blockchain/wallet-provider-kind'

type EmbeddedPath = 'unset' | 'yes' | 'no'

/**
 * Smart account + Pimlico paymaster when:
 * - AA auth: user unlocked embedded wallet (WalletProvider signing session), or
 * - Privy/Web3Auth: embedded social/email wallet on Celo Sepolia (not external WC/MetaMask).
 *
 * `submissionOwnerAddress` — Safe when sponsored, else EOA `address`.
 */
export function useSmartAccountClient(): {
  client: unknown | null
  smartAccountAddress: Address | null
  submissionOwnerAddress: Address | undefined
  isLoading: boolean
  error: Error | null
  expectsSponsoredGas: boolean
} {
  const aa = isAaAuthEnabledClient()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { address: appAddress, canTransact } = useAppWalletAddress()
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount()
  const { smartAccountAddress: aaSmartAddress, getGaslessClient, hasActiveSigningSession } =
    useWallet()
  const chainId = useResolvedChainId()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<unknown | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null)
  const [scLoading, setScLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [embeddedPath, setEmbeddedPath] = useState<EmbeddedPath>(() =>
    aa && isPaymasterConfigured() ? 'yes' : !isPaymasterConfigured() || !isPrivyEnabled ? 'no' : 'unset'
  )

  const address = appAddress ?? wagmiAddress
  const isConnected = aa ? Boolean(appAddress) : wagmiConnected

  // AA embedded wallet: build gasless client from unlocked signing session
  useEffect(() => {
    if (!aa || !isEmbeddedAccount || !isPaymasterConfigured()) return

    if (!canTransact || !hasActiveSigningSession) {
      setClient(null)
      setSmartAccountAddress(aaSmartAddress)
      setError(null)
      setScLoading(false)
      setEmbeddedPath(canTransact ? 'yes' : 'no')
      return
    }

    let cancelled = false
    setEmbeddedPath('yes')
    setError(null)
    setScLoading(true)
    setClient(null)
    setSmartAccountAddress(aaSmartAddress)

    void (async () => {
      try {
        const gasless = await getGaslessClient()
        if (!cancelled) {
          setClient(gasless)
          setSmartAccountAddress(aaSmartAddress)
          if (!gasless) {
            setError(new Error('Signing session expired. Unlock your wallet in Smart account settings.'))
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
          setClient(null)
        }
      } finally {
        if (!cancelled) setScLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [aa, isEmbeddedAccount, canTransact, hasActiveSigningSession, aaSmartAddress, getGaslessClient])

  // Privy / RainbowKit embedded path (unchanged)
  useEffect(() => {
    if (aa) return
    if (!isPaymasterConfigured() || !isPrivyEnabled) {
      setEmbeddedPath('no')
      return
    }
    if (!wagmiConnected || !connector || chainId !== REQUIRED_CHAIN_ID) {
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
  }, [aa, wagmiConnected, connector, chainId])

  useEffect(() => {
    if (aa) return
    if (embeddedPath !== 'yes') {
      setClient(null)
      setSmartAccountAddress(null)
      setError(null)
      setScLoading(false)
    }
  }, [aa, embeddedPath])

  useEffect(() => {
    if (aa) return
    if (embeddedPath !== 'yes') return
    if (!wagmiConnected || !address || chainId !== REQUIRED_CHAIN_ID || !walletClient?.account?.address) {
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
  }, [aa, embeddedPath, wagmiConnected, address, chainId, walletClient])

  const expectsSponsoredGas = aa
    ? isPaymasterConfigured() && isEmbeddedAccount && canTransact
    : embeddedPath === 'yes'

  const detectingEmbedded =
    !aa && embeddedPath === 'unset' && isPaymasterConfigured() && isPrivyEnabled

  const submissionOwnerAddress = useMemo(() => {
    if (!address || !isConnected) return undefined

    if (aa) {
      if (!isEmbeddedAccount) {
        if (chainId != null && chainId !== REQUIRED_CHAIN_ID) return undefined
        // External MetaMask/WC: submissions and claims use the connected EOA, not a stale AA address from a prior session.
        return address as Address
      }
      // Submissions are owned by the smart account; keep that identity even when the wallet is locked.
      if (aaSmartAddress) return aaSmartAddress
      return address as Address
    }

    if (chainId !== REQUIRED_CHAIN_ID) return undefined

    if (!walletClient?.account?.address) return undefined

    if (!isPaymasterConfigured() || !isPrivyEnabled || embeddedPath === 'no') {
      return address as Address
    }

    if (embeddedPath !== 'yes') return undefined

    if (!client && !error) return undefined
    return (smartAccountAddress ?? address) as Address
  }, [
    address,
    isConnected,
    chainId,
    aa,
    isEmbeddedAccount,
    canTransact,
    aaSmartAddress,
    walletClient,
    embeddedPath,
    client,
    error,
    smartAccountAddress,
    scLoading,
  ])

  return {
    client,
    smartAccountAddress: aa ? aaSmartAddress : smartAccountAddress,
    submissionOwnerAddress,
    isLoading: detectingEmbedded || (expectsSponsoredGas && scLoading),
    error,
    expectsSponsoredGas,
  }
}
