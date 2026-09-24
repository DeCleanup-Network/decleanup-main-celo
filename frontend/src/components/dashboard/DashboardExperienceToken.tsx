'use client'

import { ExternalLink } from 'lucide-react'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { getExperienceDisplay } from '@/lib/blockchain/experience-display'

type Props = {
  chainId: number
}

/** Reward-token credentials for the active experience (Base $bDCU, Celo $cDCU). */
export function DashboardExperienceToken({ chainId }: Props) {
  const chain = getExperienceDisplay(chainId)
  if (!chain.tokenAddress) return null

  return (
    <div className="w-full min-w-0 max-w-full rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <p className="text-xs font-sans font-semibold tracking-wide text-muted-foreground">
        {chain.tokenSymbol} on {chain.networkName}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Add this token in your wallet. Symbol {chain.tokenTicker}, 18 decimals.
      </p>
      <div className="mt-2">
        <CopyableAddress
          address={chain.tokenAddress}
          truncate
          className="text-xs text-foreground"
        />
      </div>
      {chain.tokenExplorerHref ? (
        <a
          href={chain.tokenExplorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-green hover:underline"
        >
          Open on {chain.explorerName}
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      ) : null}
    </div>
  )
}
