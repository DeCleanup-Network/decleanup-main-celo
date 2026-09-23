'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { AirdropClaimPanel } from '@/components/airdrop/AirdropClaimPanel'
import { isBaseExperience } from '@/lib/blockchain/chain-preference'

function AirdropFallback() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="h-32 animate-pulse rounded-2xl bg-card" />
    </main>
  )
}

export default function AirdropPage() {
  const [basePath, setBasePath] = useState(false)
  useEffect(() => {
    setBasePath(isBaseExperience())
  }, [])

  if (basePath) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl text-white">Airdrop is on Celo only</h1>
        <p className="text-sm text-white/60">
          The past contributor $cDCU airdrop is not part of the Base experience. Switch to Celo from the
          network picker if you need to claim.
        </p>
        <Link href="/" className="text-brand-green underline underline-offset-2">
          Back home
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<AirdropFallback />}>
        <AirdropClaimPanel />
      </Suspense>
    </main>
  )
}
