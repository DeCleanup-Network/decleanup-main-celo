'use client'

import Link from 'next/link'
import { ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { FeeDisplay } from '@/components/ui/fee-display'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'
import { usePastContributorBadge } from '@/hooks/usePastContributorBadge'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { useWallet } from '@/providers/WalletProvider'
import { PastContributorBadge } from '@/components/badges/PastContributorBadge'
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
  const { showVerifierFeatures } = useVerifierAccess({ defer: true })
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { eoaAddress } = useWallet()
  const badgeAddress =
    isEmbeddedAccount && eoaAddress
      ? eoaAddress
      : (submissionOwnerAddress ?? address)
  const { showPastContributorBadge } = usePastContributorBadge(badgeAddress)

  const portfolioOwner = submissionOwnerAddress ?? address
  const impactHref = `/impact/${portfolioOwner}`

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <SectionHeading icon={TrendingUp}>Profile and Rewards</SectionHeading>
      {showPastContributorBadge ? (
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
          'mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm',
          !showVerifierFeatures && '-mt-1'
        )}
      >
        Complete cleanups, build your rank and reputation, create impact profile
      </p>
      <Button variant="outline" asChild className="w-full border-border font-heading tracking-wide sm:w-auto">
        <Link href={impactHref} className="inline-flex items-center justify-center gap-2">
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          Impact portfolio
        </Link>
      </Button>
      {cleanupStatus?.canClaim && claimFeeInfo?.enabled && claimFeeInfo.fee > 0n ? (
        <div className="mt-3">
          <FeeDisplay feeAmount={claimFeeInfo.fee} feeSymbol="CELO" type="claim" className="mt-1" />
        </div>
      ) : null}
    </div>
  )
}
