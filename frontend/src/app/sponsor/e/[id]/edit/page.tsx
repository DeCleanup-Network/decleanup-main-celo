import { SponsorCampaignEditForm } from '@/components/sponsor/SponsorCampaignEditForm'

export default function SponsorEventEditPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <SponsorCampaignEditForm eventId={params.id} />
    </main>
  )
}
