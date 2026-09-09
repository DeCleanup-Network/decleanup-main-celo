import type { Address } from 'viem'

const MAX_AGE_MS = 10 * 60 * 1000

export function assertFreshTimestamp(timestamp: number, label = 'signature') {
  const now = Date.now()
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_AGE_MS) {
    throw new Error(`${label} expired. Sign again and retry.`)
  }
}

export function buildTrashAthleteReviewMessage(params: {
  action: 'approve' | 'reject'
  challengeId: string
  reviewer: Address
  timestamp: number
}): string {
  return [
    'DeCleanup Trash Athlete Challenge review',
    `action:${params.action}`,
    `challengeId:${params.challengeId}`,
    `reviewer:${params.reviewer.toLowerCase()}`,
    `timestamp:${params.timestamp}`,
  ].join('\n')
}

/** WalletConnect / external wallet proof for challenge submit. */
export function buildTrashAthleteSubmitMessage(params: {
  username: string
  socialProfileUrl: string
  notes: string
  wallet: Address
  timestamp: number
}): string {
  return [
    'DeCleanup Trash Athlete Challenge submit',
    `username:${params.username}`,
    `socialProfileUrl:${params.socialProfileUrl}`,
    `notes:${params.notes}`,
    `wallet:${params.wallet.toLowerCase()}`,
    `timestamp:${params.timestamp}`,
  ].join('\n')
}
