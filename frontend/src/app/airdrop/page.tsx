'use client'

import { Suspense } from 'react'
import { AirdropClaimPanel } from '@/components/airdrop/AirdropClaimPanel'

function AirdropFallback() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="h-32 animate-pulse rounded-2xl bg-card" />
    </main>
  )
}

export default function AirdropPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<AirdropFallback />}>
        <AirdropClaimPanel />
      </Suspense>
    </main>
  )
}
