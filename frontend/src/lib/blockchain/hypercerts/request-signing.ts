import type { Address } from 'viem'

const MAX_AGE_MS = 15 * 60 * 1000

export function assertFreshTimestamp(ts: number): void {
  const now = Date.now()
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_MS) {
    throw new Error('Signature timestamp expired or invalid')
  }
}

/** Sign a short commitment (keccak256 of metadata JSON) instead of the full JSON string. */
export function buildCreateRequestMessageCompact(params: {
  requester: Address
  metadataCommitment: `0x${string}`
  timestamp: number
}): string {
  return [
    'DeCleanup Hypercert Request v1',
    `Requester: ${params.requester.toLowerCase()}`,
    `MetadataCommitment: ${params.metadataCommitment}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}

export function buildReviewMessage(params: {
  action: 'approve' | 'reject'
  requestId: string
  reviewer: Address
  timestamp: number
}): string {
  return [
    'DeCleanup Hypercert Review v1',
    `Action: ${params.action}`,
    `RequestId: ${params.requestId}`,
    `Reviewer: ${params.reviewer.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}

/** Requester signs to publish an approved certificate to Hyperscan (AT Protocol). */
export function buildPublishMessage(params: {
  requestId: string
  requester: Address
  timestamp: number
}): string {
  return [
    'DeCleanup Hypercert Publish v1',
    `RequestId: ${params.requestId}`,
    `Requester: ${params.requester.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}

/** Requester withdraws an unpublished Hypercert request to submit a new one. */
export function buildCancelMessage(params: {
  requestId: string
  requester: Address
  timestamp: number
}): string {
  return [
    'DeCleanup Hypercert Cancel v1',
    `RequestId: ${params.requestId}`,
    `Requester: ${params.requester.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}
