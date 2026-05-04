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

export function buildMintRecordMessage(params: {
  requestId: string
  requester: Address
  hypercertId: string
  txHash: string
  metadataCid: string
  timestamp: number
}): string {
  return [
    'DeCleanup Hypercert Mint Record v1',
    `RequestId: ${params.requestId}`,
    `Requester: ${params.requester.toLowerCase()}`,
    `HypercertId: ${params.hypercertId}`,
    `TxHash: ${params.txHash}`,
    `MetadataCid: ${params.metadataCid}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}
