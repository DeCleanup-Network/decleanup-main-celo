'use client'

import { useState } from 'react'
import { Copy, Loader2, Share2 } from 'lucide-react'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { generateReferralLink, formatImpactShareMessage, shareOnFarcaster, shareOnX } from '@/lib/utils/sharing'
import { cn } from '@/lib/utils'

type NotifyPayload = { title: string; message: string; variant?: 'success' | 'info' | 'error' }

type Props = {
  /** Canonical EOA referral identity (matches portfolio and airdrop address). */
  referralAddress: Address
  /** Impact Product level (for Farcaster share text); use ≥1 if none yet. */
  impactLevel: number
  /** Section title (e.g. home: "Invite Friends", profile: "Your referral link"). */
  title?: string
  onNotify?: (p: NotifyPayload) => void
  className?: string
}

export function DashboardReferralLinkCard({
  referralAddress,
  impactLevel,
  title = 'YOUR REFERRAL LINK',
  onNotify,
  className,
}: Props) {
  const [copying, setCopying] = useState(false)
  const link = generateReferralLink(referralAddress)
  const levelForShare = impactLevel > 0 ? impactLevel : 1

  const handleCopy = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(link)
      onNotify?.({ title: 'Copied', message: 'Referral link copied to clipboard.', variant: 'success' })
    } catch {
      onNotify?.({ title: 'Referral link', message: link, variant: 'info' })
    } finally {
      setCopying(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4 sm:p-6',
        className
      )}
    >
      <SectionHeading icon={Share2}>{title}</SectionHeading>
      <p className="-mt-1 mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        When their first level is claimed, you both earn DCU points.
      </p>
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] text-foreground sm:text-xs">
          {link}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-border text-foreground hover:bg-muted"
          disabled={copying}
          onClick={() => void handleCopy()}
        >
          {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1.5">Copy</span>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-border hover:bg-muted"
          onClick={() => shareOnX('Join me on DeCleanup Rewards — verified real-world cleanups onchain.', link)}
        >
          Share on X
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-border hover:bg-muted"
          onClick={() => shareOnFarcaster(formatImpactShareMessage(levelForShare, link, 'web'))}
        >
          Farcaster
        </Button>
      </div>
    </div>
  )
}
