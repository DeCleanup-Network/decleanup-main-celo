'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useWallet } from '@/providers/WalletProvider'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import {
  airdropPageUrl,
  clearPendingAirdropAddress,
  readPendingAirdropAddress,
} from '@/lib/airdrop/pending-session'

type AirdropCheck = {
  eligible?: boolean
  claimableWei?: string
  claimed?: boolean
}

/**
 * Shown only when session has a checked address AND the server confirms a claimable allocation.
 */
export function AirdropPendingBanner() {
  const { showMainApp, address, walletBootstrapping } = useAppWalletAddress()
  const { smartAccountAddress } = useWallet()
  const { isEmbeddedAccount: embedded } = useEmbeddedAuth()
  const [sessionAddress, setSessionAddress] = useState<string | null>(null)
  const [check, setCheck] = useState<AirdropCheck | null>(null)

  // Embedded users: only their smart account (never stale session from a pre-login paste).
  // External wallet: session from /airdrop check or connected address.
  const verifyAddress = embedded
    ? smartAccountAddress ?? null
    : sessionAddress || address || null

  useEffect(() => {
    setSessionAddress(readPendingAirdropAddress())
  }, [])

  useEffect(() => {
    if (!showMainApp || !verifyAddress || (embedded && walletBootstrapping)) {
      setCheck(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/airdrop/check?address=${encodeURIComponent(verifyAddress)}`)
        const data = (await res.json().catch(() => ({}))) as AirdropCheck
        if (cancelled) return
        if (!data.eligible || data.claimed || BigInt(data.claimableWei ?? '0') <= 0n) {
          setCheck(null)
          if (!data.eligible) clearPendingAirdropAddress()
        } else {
          setCheck(data)
        }
      } catch {
        if (!cancelled) setCheck(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showMainApp, verifyAddress, embedded, walletBootstrapping])

  if (!showMainApp || !check || !verifyAddress) return null

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
          <Link href={airdropPageUrl(verifyAddress)}>Claim airdrop</Link>
        </Button>
      </div>
    </section>
  )
}
