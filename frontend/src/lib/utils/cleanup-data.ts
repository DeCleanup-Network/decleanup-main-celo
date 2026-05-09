/**
 * Utility functions to clear pending cleanup data from localStorage
 * Useful when a cleanup submission glitched or needs to be cleared
 */

import { Address } from 'viem'

function uniqueCleanupIdentityKeys(...userAddresses: (Address | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of userAddresses) {
    if (!a) continue
    const low = String(a).toLowerCase()
    if (seen.has(low)) continue
    seen.add(low)
    out.push(low)
  }
  return out
}

/**
 * Clear pending cleanup keys for one or more wallet identities (EOA + smart account, etc.).
 * Also removes legacy global keys once.
 */
export function clearPendingCleanupDataForIdentities(
  ...userAddresses: (Address | undefined | null)[]
): void {
  if (typeof window === 'undefined') return

  const unique = uniqueCleanupIdentityKeys(...userAddresses)
  for (const addressLower of unique) {
    localStorage.removeItem(`pending_cleanup_id_${addressLower}`)
    localStorage.removeItem(`pending_cleanup_location_${addressLower}`)
  }

  localStorage.removeItem('pending_cleanup_id')
  localStorage.removeItem('pending_cleanup_location')

  console.log('Cleared pending cleanup data for:', unique.length ? unique.join(', ') : '(none)')
}

/**
 * Clear all pending cleanup data for a specific wallet address
 */
export function clearPendingCleanupData(userAddress: Address): void {
  clearPendingCleanupDataForIdentities(userAddress)
}

/**
 * Clear all cleanup-related localStorage data (for debugging)
 */
export function clearAllCleanupData(): void {
  if (typeof window === 'undefined') return

  // Clear all keys that start with pending_cleanup
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('pending_cleanup') || key.startsWith('last_cleanup'))) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log('Cleared all cleanup data:', keysToRemove)
}

/**
 * Check if there's pending cleanup data for a user
 */
export function hasPendingCleanupData(userAddress: Address): boolean {
  if (typeof window === 'undefined') return false

  const addressLower = userAddress.toLowerCase()
  const pendingKey = `pending_cleanup_id_${addressLower}`
  return !!localStorage.getItem(pendingKey)
}

/**
 * Get pending cleanup ID for a user (if exists)
 */
export function getPendingCleanupId(userAddress: Address): string | null {
  if (typeof window === 'undefined') return null

  const addressLower = userAddress.toLowerCase()
  const pendingKey = `pending_cleanup_id_${addressLower}`
  return localStorage.getItem(pendingKey)
}

/**
 * Reset submission counting for one or more identities — clears all pending cleanup data.
 * Use with caution - only if you're sure the cleanup is glitched or doesn't exist.
 */
export function resetSubmissionCounting(...userAddresses: (Address | undefined | null)[]): void {
  if (typeof window === 'undefined') return

  clearPendingCleanupDataForIdentities(...userAddresses)
  localStorage.removeItem(`last_cleanup_location`)

  const unique = uniqueCleanupIdentityKeys(...userAddresses)
  console.log('Submission counting reset for:', unique.length ? unique.join(', ') : '(none)')
  console.log('User can now submit a new cleanup')
}
