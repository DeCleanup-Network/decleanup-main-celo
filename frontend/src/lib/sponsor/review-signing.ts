import type { Address } from 'viem'

const MAX_AGE_MS = 10 * 60 * 1000

export function assertFreshTimestamp(timestamp: number, label = 'signature') {
  const now = Date.now()
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_AGE_MS) {
    throw new Error(`${label} expired. Sign again and retry.`)
  }
}

/** Wallet proof for verifier funding application review. */
export function buildFundingReviewMessage(params: {
  action: 'approve' | 'reject'
  eventId: string
  reviewer: Address
  timestamp: number
}): string {
  return [
    'DeCleanup funding application review',
    `action:${params.action}`,
    `eventId:${params.eventId}`,
    `reviewer:${params.reviewer.toLowerCase()}`,
    `timestamp:${params.timestamp}`,
  ].join('\n')
}
