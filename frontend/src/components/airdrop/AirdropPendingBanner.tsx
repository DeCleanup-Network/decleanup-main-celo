'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { airdropPageUrl, readPendingAirdropAddress } from '@/lib/airdrop/pending-session'

/** Shown on the dashboard when user checked eligibility before sign-in. */
export function AirdropPendingBanner() {
  const { showMainApp } = useAppWalletAddress()
  const [pendingAddress, setPendingAddress] = useState<string | null>(null)

  useEffect(() => {
    setPendingAddress(readPendingAirdropAddress())
  }, [])

  if (!showMainApp || !pendingAddress) return null

  return (
    <section
      aria-label="Pending airdrop claim"
      className="rounded-xl border border-brand-green/40 bg-brand-green/10 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Your airdrop is ready to claim</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You already checked eligibility. Continue to claim without entering your address again.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 bg-brand-green text-black hover:bg-brand-green/90">
          <Link href={airdropPageUrl(pendingAddress)}>Claim airdrop</Link>
        </Button>
      </div>
    </section>
  )
}
