'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { useRouter } from 'next/navigation'
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { formatEther, type Address } from 'viem'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { useENSName } from '@/hooks/useENSName'
import { useSignOutAll } from '@/hooks/useSignOutAll'
import { useWalletConnectionMode } from '@/hooks/useWalletConnectionMode'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
} from '@/lib/blockchain/chain-constants'

function chainLabel(chainId: number | undefined): string {
  if (chainId === REQUIRED_CHAIN_ID) return REQUIRED_CHAIN_NAME
  if (chainId == null) return 'Unknown'
  return `Chain ${chainId}`
}

function formatCeloDisplay(wei: bigint): string {
  const ether = formatEther(wei)
  const n = Number(ether)
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  if (n < 1) return n.toFixed(4)
  if (n < 10_000) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function ExternalWalletSettingsPage() {
  const router = useRouter()
  const { hasExternalWallet, hasSmartAccountSession } = useWalletConnectionMode()
  const { signOutAll, disconnecting: signingOut } = useSignOutAll()
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { ensName, isLoading: ensLoading, lookupFailed } = useENSName(address as Address | undefined)
  const {
    data: chainBalance,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useBalance({
    address,
    chainId: REQUIRED_CHAIN_ID,
  })

  const wrongNetwork = isConnected && chainId != null && chainId !== REQUIRED_CHAIN_ID

  useEffect(() => {
    if (!isConnected) {
      router.replace('/')
      return
    }
    if (hasSmartAccountSession && !hasExternalWallet) {
      router.replace('/wallet')
    }
  }, [isConnected, hasSmartAccountSession, hasExternalWallet, router])

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (!hasExternalWallet) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-gray-400 space-y-3">
        <p>
          Wallet settings are for MetaMask and other browser wallets. Sign out of Google or email first, then
          connect MetaMask from the home page or sign-in screen.
        </p>
        <Link href="/wallet" className="block text-brand-green underline">
          Smart account settings
        </Link>
        <BackToDeCleanupLink className="text-sm" />
      </div>
    )
  }

  const disconnectAll = () => void signOutAll({ callbackUrl: '/login' })

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <BackToDeCleanupLink />
        <h1 className="mt-2 font-bebas text-2xl tracking-wider text-white sm:text-3xl">Wallet settings</h1>
        <p className="mt-1 text-base text-gray-400">
          External wallet connected via {connector?.name ?? 'browser extension'}
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Connected account</h2>
        {address && <CopyableAddress address={address} className="text-sm text-gray-200" />}
        <div className="space-y-1 text-sm">
          <p className="text-gray-500">ENS name (Ethereum mainnet)</p>
          {ensLoading ? (
            <p className="text-gray-400">Looking up…</p>
          ) : ensName ? (
            <p className="font-bebas text-xl tracking-wide text-brand-green">{ensName}</p>
          ) : lookupFailed ? (
            <p className="text-gray-400">
              Could not look up ENS right now. Your address above is still valid.
            </p>
          ) : (
            <p className="text-gray-400">
              None set for this address. Many wallets have no ENS; you can still use DeCleanup Rewards with the
              address shown.
            </p>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-gray-500">Balance ({REQUIRED_CHAIN_NAME})</p>
          {balanceLoading ? (
            <p className="text-gray-400">Loading…</p>
          ) : balanceError ? (
            <p className="text-gray-400">Could not load balance right now.</p>
          ) : (
            <p className="font-medium text-white">
              {formatCeloDisplay(chainBalance?.value ?? 0n)} CELO
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Network</h2>
        <p className="text-sm text-gray-400">
          Current: <span className="text-gray-200">{chainLabel(chainId)}</span>
          {wrongNetwork && (
            <span className="block mt-1 text-amber-300">
              DeCleanup Rewards expects {REQUIRED_CHAIN_NAME}. Switch below before submitting onchain.
            </span>
          )}
        </p>
        <Button
          type="button"
          disabled={switching || !wrongNetwork}
          className="w-full disabled:opacity-50"
          onClick={() => switchChain({ chainId: REQUIRED_CHAIN_ID })}
        >
          {switching ? 'Switching…' : `Switch to ${REQUIRED_CHAIN_NAME}`}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <Button
          type="button"
          variant="outline"
          disabled={signingOut}
          className="w-full border-white/10 text-foreground"
          onClick={disconnectAll}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </div>
  )
}
