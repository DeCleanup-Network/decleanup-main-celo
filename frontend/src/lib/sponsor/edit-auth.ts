import { isAddress } from 'viem'
import type { SponsorEventDto } from '@/lib/sponsor/types'

export function sameWallet(a?: string | null, b?: string | null): boolean {
  if (!a || !b || !isAddress(a) || !isAddress(b)) return false
  return a.toLowerCase() === b.toLowerCase()
}

export function isSponsorEventOwner(
  event: Pick<SponsorEventDto, 'submittedBy' | 'recipientAddress'>,
  wallet?: string | null
): boolean {
  if (!wallet) return false
  return sameWallet(event.submittedBy, wallet) || sameWallet(event.recipientAddress, wallet)
}
