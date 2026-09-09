'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HelpCircle } from 'lucide-react'
import type { Address } from 'viem'
import type { AaWalletState } from '@/hooks/useAaWallet'
import { GasSponsorshipBadge } from '@/components/aa/GasSponsorshipBadge'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { Button } from '@/components/ui/button'
import { chainLabelFromId } from '@/components/aa/WalletAccountHelpModal'
import { getClientCdcuTokenBalance } from '@/lib/smart-account/client'

type Props = {
  wallet: AaWalletState | null
  loading: boolean
}

function formatTokenDisplay(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (n === 0) return '0'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function CeloNetworkHelpModal({ open, onClose, chainId }: { open: boolean; onClose: () => void; chainId: number }) {
  if (!open) return null

  const isMainnet = chainId === 42220
  const title = isMainnet ? 'Celo Mainnet' : chainLabelFromId(chainId)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celo-network-help-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="celo-network-help-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-gray-300">
          {isMainnet ? (
            <>
              <p>
                <strong className="text-white">Celo Mainnet</strong> is the live blockchain DeCleanup Rewards uses
                for cleanups, rewards, and $cDCU.
              </p>
              <p className="text-gray-400">
                Chain ID <span className="font-mono text-gray-300">42220</span>. Public RPC:{' '}
                <span className="font-mono text-[11px] text-gray-500 break-all">https://forno.celo.org</span>
              </p>
              <p className="text-gray-400">
                Explorer:{' '}
                <a
                  href="https://celoscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green hover:underline"
                >
                  celoscan.io
                </a>
              </p>
            </>
          ) : (
            <p>
              You are connected to {title} (chain ID {chainId}). Production DeCleanup Rewards uses Celo Mainnet
              (42220).
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function WalletStatusCard({ wallet, loading }: Props) {
  const [networkHelpOpen, setNetworkHelpOpen] = useState(false)
  const [cdcuBalance, setCdcuBalance] = useState<string | null>(null)

  /** Display identity + $cDCU: signer EOA (MetaMask / import). CELO gas may still sit on the smart account. */
  const displayAddress = wallet?.eoaAddress || wallet?.smartAccountAddress
  const cdcuBalanceAddress = (wallet?.eoaAddress || wallet?.smartAccountAddress) as Address | undefined

  useEffect(() => {
    if (!cdcuBalanceAddress) {
      setCdcuBalance(null)
      return
    }
    let cancelled = false
    void (async () => {
      const bal = await getClientCdcuTokenBalance(cdcuBalanceAddress)
      if (cancelled) return
      if (bal == null) {
        setCdcuBalance(null)
        return
      }
      const n = Number(bal)
      setCdcuBalance(Number.isFinite(n) && n > 0 ? bal : null)
    })()
    return () => {
      cancelled = true
    }
  }, [cdcuBalanceAddress])

  if (loading && !wallet) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-800" />
        <div className="mt-4 h-3 w-full rounded bg-gray-800" />
        <div className="mt-2 h-3 w-2/3 rounded bg-gray-800" />
      </div>
    )
  }

  if (!wallet || !displayAddress) return null

  const networkShort =
    wallet.chainId === 42220 || wallet.chainId === 11142220 ? 'Celo' : chainLabelFromId(wallet.chainId)
  const portfolioHref = `/impact/${displayAddress}`

  return (
    <>
      <div className="rounded-xl border border-brand-green/25 bg-gray-900/60 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-sm tracking-wider text-white sm:text-base">
            YOUR ACCOUNT ADDRESS
          </h2>
          <GasSponsorshipBadge enabled={wallet.gaslessEnabled} />
        </div>

        <CopyableAddress address={displayAddress} truncate={false} className="text-sm text-gray-200" />

        <Link
          href={portfolioHref}
          className="inline-flex text-sm font-medium text-brand-green hover:underline"
        >
          View impact portfolio
        </Link>

        <div className="flex flex-wrap gap-6 border-t border-gray-800 pt-4 text-sm">
          <div>
            <span className="text-gray-500">Balance </span>
            <span className="font-medium text-white">{wallet.balance} CELO</span>
          </div>
          {cdcuBalance ? (
            <div>
              <span className="text-gray-500">$cDCU </span>
              <span className="font-medium text-white">{formatTokenDisplay(cdcuBalance)}</span>
            </div>
          ) : null}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-gray-500">Network </span>
            <span className="font-medium text-white">{networkShort}</span>
            <button
              type="button"
              onClick={() => setNetworkHelpOpen(true)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-brand-green"
              aria-label="What is Celo Mainnet?"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <CeloNetworkHelpModal
        open={networkHelpOpen}
        onClose={() => setNetworkHelpOpen(false)}
        chainId={wallet.chainId}
      />
    </>
  )
}
