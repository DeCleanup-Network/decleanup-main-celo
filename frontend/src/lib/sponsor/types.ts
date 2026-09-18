export type SponsorEventStatus = 'pending' | 'active' | 'upcoming' | 'ended'

export type SponsorEventDto = {
  id: string
  name: string
  location: string
  organiser: string
  eventDate: string | null
  fundingGoalCusd: number
  amountRaisedCusd: number
  verifiedCleanupsCount: number
  recipientAddress: string
  status: SponsorEventStatus
  submittedBy?: string | null
  whyFunding?: string | null
  communitySize?: string | null
  eventFrequency?: string | null
  impactSummary?: string | null
  socialLinks?: string | null
  impactPortfolioUrl?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
}

export type SponsorEventInput = {
  name: string
  location: string
  organiser: string
  eventDate?: string | null
  fundingGoalCusd: number
  recipientAddress: string
  verifiedCleanupsCount?: number
  status: SponsorEventStatus
  submittedBy?: string | null
  whyFunding?: string | null
  communitySize?: string | null
  eventFrequency?: string | null
  impactSummary?: string | null
  socialLinks?: string | null
  impactPortfolioUrl?: string | null
}
