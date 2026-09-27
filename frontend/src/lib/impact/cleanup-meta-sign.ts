export function buildCleanupMetaSignMessage(params: {
  submissionId: string
  amount: number
  unit: string
  timestamp: number
}): string {
  return [
    'DeCleanup cleanup-meta',
    `submissionId:${params.submissionId}`,
    `amount:${params.amount}`,
    `unit:${params.unit}`,
    `timestamp:${params.timestamp}`,
  ].join('\n')
}
