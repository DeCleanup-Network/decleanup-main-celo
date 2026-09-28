'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { FeeDisplay } from '@/components/ui/fee-display'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'
import { usePastContributorBadge } from '@/hooks/usePastContributorBadge'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { useWallet } from '@/providers/WalletProvider'
import { PastContributorBadge } from '@/components/badges/PastContributorBadge'
import { useExperienceChain, useShowImpactPortfolio } from '@/hooks/useExperienceChain'
import { getExperienceDisplay } from '@/lib/blockchain/experience-display'
import { cn } from '@/lib/utils'

type Props = {
  address: string
  submissionOwnerAddress?: string
  onOpenVerifierRules: () => void
  cleanupStatus?: {
    canClaim?: boolean
  } | null
  claimFeeInfo?: { fee: bigint; enabled: boolean } | null
}

export function DashboardProfileCard({
  address,
  submissionOwnerAddress,
  onOpenVerifierRules,
  cleanupStatus,
  claimFeeInfo,
}: Props) {
  const { data: session } = useSession()
  const { showVerifierFeatures } = useVerifierAccess({ defer: true })
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { eoaAddress, smartAccountAddress } = useWallet()
  const displayAddress =
    isEmbeddedAccount && eoaAddress ? eoaAddress : address
  const accountEmail =
    isEmbeddedAccount && session?.user?.email ? session.user.email : null
  const badgeAddress =
    isEmbeddedAccount && eoaAddress
      ? eoaAddress
      : (submissionOwnerAddress ?? address)
  const { showPastContributorBadge } = usePastContributorBadge(badgeAddress)
  const { chainId: experienceChainId, isCelo } = useExperienceChain()
  const showImpactPortfolio = useShowImpactPortfolio()
  const chain = getExperienceDisplay(experienceChainId)
  const showAirdropBadge = showPastContributorBadge && isCelo

  /** Impact / onchain activity is keyed by smart account when gasless. */
  const portfolioOwner =
    (isEmbeddedAccount && (submissionOwnerAddress || smartAccountAddress)) ||
    submissionOwnerAddress ||
    address
  const impactHref = `/impact/${portfolioOwner}`

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <SectionHeading icon={TrendingUp}>Profile and Rewards</SectionHeading>
      {showAirdropBadge ? (
        <div className="mb-2">
          <PastContributorBadge size="md" />
        </div>
      ) : null}
      {showVerifierFeatures ? (
        <div className="mb-2">
          <button
            type="button"
            onClick={onOpenVerifierRules}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/45 bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-green transition-colors hover:bg-brand-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Verifier
          </button>
        </div>
      ) : null}
      <p
        className={cn(
          'mb-3 text-xs leading-relaxed text-muted-foreground sm:text-sm',
          !showVerifierFeatures && '-mt-1'
        )}
      >
        {showImpactPortfolio
          ? 'Complete cleanups, build your rank and reputation, create impact profile'
          : 'Complete cleanups, build your rank and reputation'}
      </p>
      {accountEmail ? (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </p>
          <p className="break-all text-xs text-foreground sm:text-sm">{accountEmail}</p>
        </div>
      ) : null}
      <div className="mb-4 space-y-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your address
          </p>
          <CopyableAddress
            address={displayAddress}
            truncate
            href={chain.addressExplorerHref(displayAddress)}
            className="text-xs text-foreground sm:text-sm"
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Network
          </p>
          <p className="text-xs text-foreground sm:text-sm">{chain.networkName}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Gas: {chain.gasSymbol}
            {chain.tokenExplorerHref ? (
              <>
                {' · '}
                <a
                  href={chain.tokenExplorerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`View ${chain.tokenSymbol} contract`}
                  className="font-medium text-brand-green hover:underline"
                >
                  {chain.tokenSymbol}
                </a>
              </>
            ) : (
              <> · {chain.tokenSymbol}</>
            )}
          </p>
        </div>
      </div>
      {showImpactPortfolio ? (
        <Button variant="outline" asChild className="w-full border-border font-heading tracking-wide sm:w-auto">
          <Link href={impactHref} className="inline-flex items-center justify-center gap-2">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            Impact portfolio
          </Link>
        </Button>
      ) : null}
      {cleanupStatus?.canClaim && claimFeeInfo?.enabled && claimFeeInfo.fee > 0n ? (
        <div className="mt-3">
          <FeeDisplay feeAmount={claimFeeInfo.fee} feeSymbol={chain.gasSymbol} type="claim" className="mt-1" />
        </div>
      ) : null}
    </div>
  )
}
