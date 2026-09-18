'use client'

import { Suspense } from 'react'
import { SponsorPanel } from '@/components/sponsor/SponsorPanel'

export default function SponsorPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <Suspense fallback={<p className="px-4 py-6 text-sm text-gray-400">Loading…</p>}>
        <SponsorPanel />
      </Suspense>
    </main>
  )
}
