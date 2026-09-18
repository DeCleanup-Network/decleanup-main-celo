export type SponsorEventStatus = 'active' | 'upcoming' | 'ended'

export type SponsorEventDto = {
  id: string
  name: string
  location: string
  organiser: string
  eventDate: string
  fundingGoalCusd: number
  amountRaisedCusd: number
  verifiedCleanupsCount: number
  recipientAddress: string
  status: SponsorEventStatus
}
