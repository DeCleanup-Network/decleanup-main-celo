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
import { getClientExperienceTokenBalance } from '@/lib/smart-account/client'
import { getExperienceDisplay } from '@/lib/blockchain/experience-display'
import { useExperienceChain } from '@/hooks/useExperienceChain'

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

function NetworkHelpModal({ open, onClose, chainId }: { open: boolean; onClose: () => void; chainId: number }) {
  if (!open) return null

  const title = chainLabelFromId(chainId)
  const isCeloMainnet = chainId === 42220
  const isBase = chainId === 8453 || chainId === 84532

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-help-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="network-help-title" className="text-lg font-semibold text-white">
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
          {isCeloMainnet ? (
            <>
              <p>
                <strong className="text-white">Celo Mainnet</strong> is the live blockchain DeCleanup Rewards uses
                for the full app: cleanups, rewards, and $cDCU.
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
          ) : isBase ? (
            <>
              <p>
                <strong className="text-white">Base</strong> is the simple cleanup path: sign in, submit proof, earn
                $bDCU. Gas is ETH.
              </p>
              <p className="text-gray-400">
                Chain ID <span className="font-mono text-gray-300">{chainId}</span>.
              </p>
              <p className="text-gray-400">
                Explorer:{' '}
                <a
                  href={chainId === 8453 ? 'https://basescan.org' : 'https://sepolia.basescan.org'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green hover:underline"
                >
                  {chainId === 8453 ? 'basescan.org' : 'sepolia.basescan.org'}
                </a>
              </p>
            </>
          ) : (
            <p>
              You are connected to {title} (chain ID {chainId}).
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
  const [tokenBalance, setTokenBalance] = useState<string | null>(null)
  const { chainId: experienceChainId } = useExperienceChain()
  const chain = getExperienceDisplay(experienceChainId)

  /** Display identity: signer EOA (MetaMask / import). */
  const displayAddress = wallet?.eoaAddress || wallet?.smartAccountAddress
  const tokenBalanceAddress = (wallet?.eoaAddress || wallet?.smartAccountAddress) as Address | undefined

  useEffect(() => {
    if (!tokenBalanceAddress) {
      setTokenBalance(null)
      return
    }
    let cancelled = false
    void (async () => {
      const bal = await getClientExperienceTokenBalance(tokenBalanceAddress, experienceChainId)
      if (cancelled) return
      if (bal == null) {
        setTokenBalance(null)
        return
      }
      const n = Number(bal)
      setTokenBalance(Number.isFinite(n) && n > 0 ? bal : null)
    })()
    return () => {
      cancelled = true
    }
  }, [tokenBalanceAddress, experienceChainId])

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

  const displayChainId = experienceChainId || wallet.chainId
  const networkShort = chainLabelFromId(displayChainId)
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
        <a
          href={chain.addressExplorerHref(displayAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-brand-green hover:underline"
        >
          View on {chain.explorerName}
        </a>

        {chain.tokenAddress ? (
          <div className="rounded-lg border border-gray-800 bg-black/30 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {chain.tokenSymbol} on {chain.networkName}
            </p>
            <CopyableAddress
              address={chain.tokenAddress}
              truncate
              className="mt-1 text-xs text-gray-200"
            />
            {chain.tokenExplorerHref ? (
              <a
                href={chain.tokenExplorerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex text-xs text-brand-green hover:underline"
              >
                {chain.tokenTicker} contract · {chain.explorerName}
              </a>
            ) : null}
          </div>
        ) : null}

        <Link
          href={portfolioHref}
          className="inline-flex text-sm font-medium text-brand-green hover:underline"
        >
          View impact portfolio
        </Link>

        <div className="flex flex-wrap gap-6 border-t border-gray-800 pt-4 text-sm">
          <div>
            <span className="text-gray-500">Balance </span>
            <span className="font-medium text-white">{wallet.balance} {chain.gasSymbol}</span>
          </div>
          {tokenBalance ? (
            <div>
              <span className="text-gray-500">{chain.tokenSymbol} </span>
              <span className="font-medium text-white">{formatTokenDisplay(tokenBalance)}</span>
            </div>
          ) : null}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-gray-500">Network </span>
            <span className="font-medium text-white">{networkShort}</span>
            <button
              type="button"
              onClick={() => setNetworkHelpOpen(true)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-brand-green"
              aria-label={`About ${networkShort}`}
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <NetworkHelpModal
        open={networkHelpOpen}
        onClose={() => setNetworkHelpOpen(false)}
        chainId={displayChainId}
      />
    </>
  )
}
