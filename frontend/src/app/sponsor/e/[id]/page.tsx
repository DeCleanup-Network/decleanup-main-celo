'use client'

import { SponsorEventSharePanel } from '@/components/sponsor/SponsorEventSharePanel'

export default function SponsorEventSharePage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <SponsorEventSharePanel eventId={params.id} />
    </main>
  )
}
