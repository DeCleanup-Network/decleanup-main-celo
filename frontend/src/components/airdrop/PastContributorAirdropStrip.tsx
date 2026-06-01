'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useWallet } from '@/providers/WalletProvider'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { readPendingAirdropAddress } from '@/lib/airdrop/pending-session'

type AirdropCheck = {
  claimed?: boolean
}

type PastContributorAirdropStripProps = {
  variant: 'prelogin' | 'app'
}

/** Footer strip for past contributors; hidden after airdrop is claimed for the checked address. */
export function PastContributorAirdropStrip({ variant }: PastContributorAirdropStripProps) {
  const { address, showMainApp } = useAppWalletAddress()
  const { smartAccountAddress } = useWallet()
  const { isEmbeddedAccount: embedded } = useEmbeddedAuth()
  const [hidden, setHidden] = useState(false)

  const checkAddress =
    variant === 'app' && showMainApp
      ? embedded
        ? smartAccountAddress ?? null
        : address ?? null
      : readPendingAirdropAddress()

  useEffect(() => {
    if (!checkAddress) {
      setHidden(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/airdrop/check?address=${encodeURIComponent(checkAddress)}`)
        const data = (await res.json().catch(() => ({}))) as AirdropCheck
        if (!cancelled && data.claimed) setHidden(true)
      } catch {
        if (!cancelled) setHidden(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [checkAddress, variant, showMainApp])

  if (hidden) return null

  const copy =
    variant === 'prelogin'
      ? 'Past contributors: check $cDCU airdrop eligibility.'
      : 'Past contributor? Check or claim your $cDCU airdrop.'

  return (
    <section
      aria-label="$cDCU airdrop for past contributors"
      className={
        variant === 'prelogin'
          ? 'w-full border-t border-brand-green/25 bg-brand-green/10 py-4'
          : 'w-full border-t border-brand-green/25 bg-brand-green/10 py-5 sm:py-6'
      }
    >
      <div
        className={
          variant === 'prelogin'
            ? 'container mx-auto flex flex-col items-center justify-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left'
            : 'mx-auto flex max-w-[1200px] flex-col items-stretch gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'
        }
      >
        <p
          className={
            variant === 'prelogin'
              ? 'text-landing-lede max-w-xl text-sm sm:text-base'
              : 'text-landing-lede text-center text-sm sm:text-left sm:max-w-xl'
          }
        >
          {copy}
        </p>
        <Button
          asChild
          className={
            variant === 'prelogin'
              ? 'shrink-0'
              : 'w-full shrink-0 sm:w-auto sm:min-w-[11rem]'
          }
        >
          <Link href="/airdrop">{variant === 'prelogin' ? 'Check airdrop' : 'Airdrop'}</Link>
        </Button>
      </div>
    </section>
  )
}
