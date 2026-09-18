export type SponsorEventStatus = 'pending' | 'active' | 'upcoming' | 'ended'

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
  submittedBy?: string | null
}

export type SponsorEventInput = {
  name: string
  location: string
  organiser: string
  eventDate: string
  fundingGoalCusd: number
  recipientAddress: string
  verifiedCleanupsCount?: number
  status: SponsorEventStatus
  submittedBy?: string | null
}
