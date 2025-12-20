/**
 * Utility to reset cleanup state for testing
 * Clears localStorage entries related to a specific cleanup
 */

import { Address } from 'viem'

export function resetCleanupState(userAddress: Address, cleanupId?: bigint | string) {
  if (typeof window === 'undefined') {
    console.warn('resetCleanupState: window is undefined, cannot clear localStorage')
    return
  }

  const addressLower = userAddress.toLowerCase()
  const cleanupIdStr = cleanupId?.toString() || ''

  console.log('[resetCleanupState] Resetting cleanup state:', {
    userAddress: addressLower,
    cleanupId: cleanupIdStr,
  })

  // Clear pending cleanup ID
  const pendingKey = `pending_cleanup_id_${addressLower}`
  localStorage.removeItem(pendingKey)
  console.log(`[resetCleanupState] Removed: ${pendingKey}`)

  // Clear pending cleanup location
  const locationKey = `pending_cleanup_location_${addressLower}`
  localStorage.removeItem(locationKey)
  console.log(`[resetCleanupState] Removed: ${locationKey}`)

  // Clear claimed cleanup IDs (remove specific cleanup ID if provided)
  const claimedKey = `claimed_cleanup_ids_${addressLower}`
  if (cleanupIdStr) {
    try {
      const claimedIds = localStorage.getItem(claimedKey)
      if (claimedIds) {
        const parsed = JSON.parse(claimedIds) as string[]
        const filtered = parsed.filter(id => id !== cleanupIdStr)
        if (filtered.length === 0) {
          localStorage.removeItem(claimedKey)
          console.log(`[resetCleanupState] Removed all claimed IDs from: ${claimedKey}`)
        } else {
          localStorage.setItem(claimedKey, JSON.stringify(filtered))
          console.log(`[resetCleanupState] Removed cleanup ${cleanupIdStr} from claimed list:`, filtered)
        }
      }
    } catch (error) {
      console.error('[resetCleanupState] Error parsing claimed IDs:', error)
      localStorage.removeItem(claimedKey)
    }
  } else {
    // Remove entire claimed list if no specific cleanup ID
    localStorage.removeItem(claimedKey)
    console.log(`[resetCleanupState] Removed: ${claimedKey}`)
  }

  // Clear old global keys for backward compatibility
  localStorage.removeItem('pending_cleanup_id')
  localStorage.removeItem('pending_cleanup_location')
  localStorage.removeItem('last_cleanup_location')

  console.log('[resetCleanupState] Cleanup state reset complete')
}

export function resetAllCleanupState(userAddress: Address) {
  if (typeof window === 'undefined') {
    console.warn('resetAllCleanupState: window is undefined, cannot clear localStorage')
    return
  }

  const addressLower = userAddress.toLowerCase()

  console.log('[resetAllCleanupState] Resetting ALL cleanup state for:', addressLower)

  // Clear all cleanup-related keys for this user
  const keysToRemove = [
    `pending_cleanup_id_${addressLower}`,
    `pending_cleanup_location_${addressLower}`,
    `claimed_cleanup_ids_${addressLower}`,
    `last_cleanup_location`,
    'pending_cleanup_id',
    'pending_cleanup_location',
  ]

  keysToRemove.forEach(key => {
    localStorage.removeItem(key)
    console.log(`[resetAllCleanupState] Removed: ${key}`)
  })

  console.log('[resetAllCleanupState] All cleanup state reset complete')
}
