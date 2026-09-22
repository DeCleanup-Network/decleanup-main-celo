import { SponsorCampaignEditForm } from '@/components/sponsor/SponsorCampaignEditForm'

export default async function SponsorEventEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <SponsorCampaignEditForm eventId={id} />
    </main>
  )
}
