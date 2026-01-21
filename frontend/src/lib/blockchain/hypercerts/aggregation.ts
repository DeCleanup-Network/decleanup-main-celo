import { CleanupReference } from './types'

export function aggregateUserCleanups(
  cleanups: CleanupReference[]
) {
  if (cleanups.length === 0) {
    throw new Error('No cleanups to aggregate')
  }

  const timestamps = cleanups.map(c => c.verifiedAt)

  return {
    totalCleanups: cleanups.length,
    timeframeStart: Math.min(...timestamps),
    timeframeEnd: Math.max(...timestamps),
  }
}