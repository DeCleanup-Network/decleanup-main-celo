import { getAddress, isAddress } from 'viem'
import type { SponsorEventDto } from '@/lib/sponsor/types'

const STORAGE_KEY = 'decleanup-sponsor-organizer'

export type OrganizerDonateMemory = {
  to: string
  cleanup?: string
  place?: string
}

export function organizerDonateEvent(opts: {
  recipient: string
  cleanupId?: string
  place?: string
}): SponsorEventDto | null {
  if (!isAddress(opts.recipient)) return null
  const recipientAddress = getAddress(opts.recipient)
  const place = opts.place?.trim() || 'Verified cleanup'
  return {
    id: opts.cleanupId ? `proof:${opts.cleanupId}` : 'proof:direct',
    name: place,
    location: place,
    organiser: 'Cleanup organizer',
    eventDate: null,
    fundingGoalCusd: 0,
    amountRaisedCusd: 0,
    verifiedCleanupsCount: 1,
    recipientAddress,
    status: 'active',
    paymentMethods: [
      { kind: 'crypto', recipientAddress },
      { kind: 'crypto-base', recipientAddress },
      { kind: 'crypto-robinhood', recipientAddress },
    ],
  }
}

export function readOrganizerDonateMemory(): OrganizerDonateMemory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrganizerDonateMemory
    if (!parsed?.to || !isAddress(parsed.to)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeOrganizerDonateMemory(memory: OrganizerDonateMemory): void {
  if (typeof window === 'undefined') return
  if (!isAddress(memory.to)) return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
}
