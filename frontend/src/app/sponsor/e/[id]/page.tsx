import type { Metadata } from 'next'
import { SponsorEventSharePanel } from '@/components/sponsor/SponsorEventSharePanel'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { sponsorEventPath } from '@/lib/sponsor/display'
import { getSponsorEventById, isSponsorshipDbConfigured } from '@/lib/supabase/sponsorship-events'

type PageProps = { params: { id: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const path = sponsorEventPath(params.id)
  const fallback = buildPageMetadata({
    title: 'Cleanup fundraiser',
    description: 'Open this DeCleanup campaign, read the story, then donate with cUSD on Celo.',
    path,
  })

  try {
    if (!isSponsorshipDbConfigured()) return fallback
    const event = await getSponsorEventById(params.id)
    if (!event) return fallback
    const description = (
      event.whyFunding?.trim() ||
      `Fund ${event.name} in ${event.location} with cUSD on Celo.`
    ).slice(0, 160)
    return buildPageMetadata({
      title: event.name,
      description,
      path,
    })
  } catch {
    return fallback
  }
}

export default function SponsorEventSharePage({ params }: PageProps) {
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <SponsorEventSharePanel eventId={params.id} />
    </main>
  )
}
