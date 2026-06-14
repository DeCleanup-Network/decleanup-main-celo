'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { Address } from 'viem'
import type { AaWalletState } from '@/hooks/useAaWallet'
import { GasSponsorshipBadge } from '@/components/aa/GasSponsorshipBadge'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { WalletAccountHelpModal, chainLabelFromId } from '@/components/aa/WalletAccountHelpModal'

type Props = {
  wallet: AaWalletState | null
  loading: boolean
}

export function WalletStatusCard({ wallet, loading }: Props) {
  const [helpOpen, setHelpOpen] = useState(false)

  if (loading && !wallet) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-800" />
        <div className="mt-4 h-3 w-full rounded bg-gray-800" />
        <div className="mt-2 h-3 w-2/3 rounded bg-gray-800" />
      </div>
    )
  }

  if (!wallet) return null

  const chainLabel = chainLabelFromId(wallet.chainId)

  return (
    <>
      <div className="rounded-xl border border-brand-green/25 bg-gray-900/60 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Your wallet address</h2>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-brand-green"
              aria-label="Learn about your smart account"
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <GasSponsorshipBadge enabled={wallet.gaslessEnabled} />
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">Smart account (onchain identity)</p>
          <CopyableAddress address={wallet.smartAccountAddress} className="text-sm text-gray-200" />
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Balance </span>
            <span className="font-medium text-white">{wallet.balance} CELO</span>
          </div>
          <div>
            <span className="text-gray-500">Network </span>
            <span className="font-medium text-white">{chainLabel}</span>
          </div>
        </div>
      </div>

      <WalletAccountHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        smartAccountAddress={wallet.smartAccountAddress as Address}
        eoaAddress={wallet.eoaAddress as Address}
        chainId={wallet.chainId}
        chainLabel={chainLabel}
      />
    </>
  )
}
