import { Address } from 'viem'
import { getCleanupDetails, findLatestClaimableCleanup } from './contracts'
import { addCrecyReward, isSubmissionRewarded } from '@/lib/utils/crecy-tracking'

/**
 * VerificationStatus
 * Frontend-only representation of a cleanup verification state.
 * Mirrors Submission.sol logic (simplified for MVP).
 */
export interface VerificationStatus {
  cleanupId: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  canClaim: boolean
}

/* -------------------------------------------------------------------------- */
/*                             LOCAL STORAGE HELPERS                           */
/* -------------------------------------------------------------------------- */

function pendingKey(user: Address) {
  return `pending_cleanup_id_${user.toLowerCase()}`
}

function claimedKey(user: Address) {
  return `claimed_cleanup_ids_${user.toLowerCase()}`
}

export function storePendingCleanup(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  localStorage.setItem(pendingKey(user), cleanupId.toString())
}

export function clearPendingCleanup(user: Address) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(pendingKey(user))
}

export function markCleanupAsClaimed(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  const key = claimedKey(user)
  const claimed = getClaimedCleanupIds(user)
  const cleanupIdStr = cleanupId.toString()
  if (!claimed.includes(cleanupIdStr)) {
    claimed.push(cleanupIdStr)
    localStorage.setItem(key, JSON.stringify(claimed))
    console.log('[verification] Marked cleanup as claimed:', {
      user,
      cleanupId: cleanupIdStr,
      allClaimed: claimed,
    })
  } else {
    console.log('[verification] Cleanup already marked as claimed:', cleanupIdStr)
  }
}

function getClaimedCleanupIds(user: Address): string[] {
  if (typeof window === 'undefined') return []
  const key = claimedKey(user)
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function isCleanupClaimed(user: Address, cleanupId: bigint): boolean {
  const claimed = getClaimedCleanupIds(user)
  return claimed.includes(cleanupId.toString())
}

function getPendingCleanupId(user: Address): bigint | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(pendingKey(user))
  if (!raw) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*                          CLEANUP STATUS RESOLUTION                          */
/* -------------------------------------------------------------------------- */

/**
 * getLatestCleanupStatus
 *
 * Source of truth:
 * - localStorage (pending cleanup id)
 * - getCleanupDetails (contracts.ts)
 * - findLatestClaimableCleanup (contracts.ts) - fallback when localStorage is empty
 *
 * If localStorage doesn't have a cleanup ID, we check the contract
 * for the latest verified but unclaimed cleanup as a fallback.
 */
export async function getLatestCleanupStatus(
  user: Address
): Promise<VerificationStatus | null> {
  let cleanupId = getPendingCleanupId(user)
  
  console.log('[verification] getLatestCleanupStatus:', {
    user,
    localStorageCleanupId: cleanupId?.toString() || 'none',
  })
  
  // Fallback: if localStorage doesn't have a cleanup ID, check the contract
  // for the latest claimable cleanup (e.g., if user is on a different device/browser)
  // BUT: Only do this on initial load, not after a claim (to prevent finding other cleanups)
  // IMPORTANT: Only check contract if we're sure the user has submitted cleanups before
  // For truly new users (no submissions), don't show claim button
  // ALSO: Skip if cleanup #3 is in claimed list (pre-fix cleanup that was manually cleared)
  if (cleanupId === null || cleanupId === undefined) {
    try {
      console.log('[verification] No cleanup ID in localStorage, checking if user has submissions...')
      // First check if user has any submissions at all
      const { getUserSubmissions } = await import('@/lib/blockchain/contracts')
      const userSubmissions = await getUserSubmissions(user)
      
      if (userSubmissions.length === 0) {
        console.log('[verification] User has no submissions, returning null (new user)')
        return null
      }
      
      console.log('[verification] User has', userSubmissions.length, 'submissions, checking for claimable cleanup...')
      const foundCleanupId = await findLatestClaimableCleanup(user)
      console.log('[verification] findLatestClaimableCleanup returned:', foundCleanupId !== null && foundCleanupId !== undefined ? foundCleanupId.toString() : 'null')
      
      // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
      if (foundCleanupId !== null && foundCleanupId !== undefined) {
        // Double-check: if this cleanup is marked as claimed in localStorage, skip it
        // (This handles pre-fix cleanups that were manually cleared)
        const isClaimed = isCleanupClaimed(user, foundCleanupId)
        if (isClaimed) {
          console.log('[verification] Found cleanup is marked as claimed in localStorage, skipping:', foundCleanupId.toString())
          return null
        }
        
        cleanupId = foundCleanupId
        console.log('[verification] Found claimable cleanup from contract:', cleanupId.toString())
        // Store it in localStorage for future checks
        storePendingCleanup(user, cleanupId)
      } else {
        console.log('[verification] No claimable cleanup found in contract')
      }
    } catch (err) {
      console.warn('[verification] Failed to find latest claimable cleanup from contract:', err)
    }
  }
  
  // If we have a cleanup ID, verify it's still claimable FIRST
  // If it's been claimed, clear it and return null (don't search for others)
  if (cleanupId !== null && cleanupId !== undefined) {
    const localClaimed = isCleanupClaimed(user, cleanupId)
    if (localClaimed) {
      console.log('[verification] Cleanup in localStorage is already claimed, clearing it')
      clearPendingCleanup(user)
      return null
    }
  }
  
  // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
  if (cleanupId === null || cleanupId === undefined) {
    console.log('[verification] No cleanup ID found, returning null')
    return null
  }

  try {
    const details = await getCleanupDetails(cleanupId)
    
    console.log('[verification] Cleanup details:', {
      cleanupId: cleanupId.toString(),
      user: details.user,
      verified: details.verified,
      rejected: details.rejected,
      claimed: details.claimed,
      rewarded: details.rewarded,
    })

    // Safety: cleanup must belong to the same user
    if (details.user.toLowerCase() !== user.toLowerCase()) {
      console.warn('[verification] Cleanup user mismatch, clearing:', {
        expected: user,
        found: details.user,
      })
      clearPendingCleanup(user)
      return null
    }

    // If cleanup doesn't exist or has invalid data, return null
    if (details.user === '0x0000000000000000000000000000000000000000') {
      console.warn('[verification] Cleanup not found on contract, clearing localStorage')
      clearPendingCleanup(user)
      return null
    }

    const verified = details.verified
    const rejected = details.rejected
    // Check localStorage FIRST as the source of truth for claimed status
    // The contract doesn't track "claimed" - it only tracks if rewards were distributed
    const localClaimed = isCleanupClaimed(user, cleanupId)
    // Don't trust contract's claimed field - it's not reliable
    // Only use localStorage to determine if user has claimed
    const claimed = localClaimed
    
    // Check if this cleanup was verified before the contract fix
    // (rewarded=true but user has no balance - indicates pre-fix cleanup)
    // IMPORTANT: Be very conservative - only mark as pre-fix if we're absolutely sure
    // For newly verified cleanups, always allow claiming (rewards might be distributed during claim)
    let isPreFixCleanup = false
    
    // Only check for pre-fix if:
    // 1. Cleanup is verified AND marked as rewarded (rewards were supposedly distributed)
    // 2. Cleanup was verified a LONG time ago (more than 1 hour) - this ensures it's definitely pre-fix
    // 3. User has 0 balance
    // This prevents false positives for newly verified cleanups
    if (verified && details.rewarded && !rejected && !claimed) {
      try {
        const now = BigInt(Math.floor(Date.now() / 1000))
        const oneHourAgo = now - BigInt(3600) // 1 hour in seconds
        
        // Only check balance if cleanup was verified more than 1 hour ago
        // This ensures we're not blocking newly verified cleanups
        if (details.timestamp && details.timestamp < oneHourAgo) {
          const { getDCUBalance } = await import('@/lib/blockchain/contracts')
          const balance = await getDCUBalance(user)
          const verifiedAgo = now - details.timestamp
          
          console.log('[verification] Balance check for pre-fix detection (verified >1h ago):', {
            cleanupId: cleanupId.toString(),
            rewarded: details.rewarded,
            balance: balance.toString(),
            balanceIsZero: balance === 0n,
            verifiedAgo: verifiedAgo.toString(),
            timestamp: details.timestamp?.toString(),
          })
          
          // Only mark as pre-fix if verified >1 hour ago AND balance is still 0
          if (balance === 0n) {
            isPreFixCleanup = true
            console.warn('[verification] ⚠️ Pre-fix cleanup detected: verified >1h ago, rewarded=true, but balance is 0')
            console.warn('[verification] Verified', verifiedAgo.toString(), 'seconds ago (>1 hour), likely pre-fix cleanup')
            console.warn('[verification] This cleanup needs manual reward distribution')
          } else {
            console.log('[verification] User has balance:', balance.toString(), '- not a pre-fix cleanup')
          }
        } else {
          const verifiedAgo = details.timestamp ? (now - details.timestamp) : BigInt(0)
          console.log('[verification] Cleanup verified recently (', verifiedAgo.toString(), 's ago, <1h). Allowing claim - rewards may be distributed during claim.')
        }
      } catch (error) {
        console.warn('[verification] Could not check balance for pre-fix detection:', error)
        // If balance check fails, assume it's not a pre-fix cleanup to avoid false positives
        // This ensures newly verified cleanups can still show claim button
      }
    } else if (verified && !details.rewarded) {
      console.log('[verification] Cleanup verified but not yet rewarded - allowing claim (rewards may be distributed during claim)')
    }
    
    // If it's a pre-fix cleanup, don't allow claiming (needs manual reward distribution)
    // BUT: Only block if we're absolutely sure it's pre-fix (verified >1h ago, balance=0)
    // For newly verified cleanups, always allow claiming (rewards might be distributed during claim)
    const canClaim = verified && !rejected && !claimed && !isPreFixCleanup
    
    // Debug: Log why canClaim might be false
    if (verified && !canClaim) {
      console.warn('[verification] ⚠️ Cleanup is verified but canClaim is false:', {
        cleanupId: cleanupId.toString(),
        verified,
        rejected,
        claimed,
        isPreFixCleanup,
        reason: rejected ? 'rejected' : claimed ? 'claimed' : isPreFixCleanup ? 'pre-fix cleanup' : 'unknown',
      })
    } else if (verified && canClaim) {
      console.log('[verification] ✅ Cleanup is verified and canClaim is true - claim button should appear')
    }
    
    console.log('[verification] Pre-fix cleanup check:', {
      cleanupId: cleanupId.toString(),
      isPreFixCleanup,
      canClaim,
      verified,
      rejected,
      claimed,
      rewarded: details.rewarded,
    })
    
    console.log('[verification] Claimed status check:', {
      cleanupId: cleanupId.toString(),
      localClaimed,
      contractClaimed: details.claimed,
      finalClaimed: claimed,
      canClaim,
    })

    console.log('[verification] Status calculation:', {
      verified,
      rejected,
      contractClaimed: details.claimed,
      localClaimed,
      claimed,
      isPreFixCleanup,
      canClaim,
    })

    // Award cRECY locally if cleanup is verified and has recyclables (testing only)
    if (verified && details.hasRecyclables && user) {
      if (!isSubmissionRewarded(user, cleanupId)) {
        addCrecyReward(user, cleanupId)
      }
    }

    // Unlock flow if terminal
    // If cleanup is claimed, clear pending cleanup and ensure it's marked
    if (claimed) {
      clearPendingCleanup(user)
      // Ensure it's marked (in case it wasn't already)
      markCleanupAsClaimed(user, cleanupId)
      // Return null to indicate no claimable cleanup (user needs to submit new one)
      return null
    } else if (rejected) {
      clearPendingCleanup(user)
      // Return null for rejected cleanups (user needs to submit new one)
      return null
    } else if (verified && canClaim) {
      // Verified and can claim - keep it in localStorage so user can see claim button
      storePendingCleanup(user, cleanupId)
    } else if (verified && !canClaim) {
      // Verified but can't claim - could be:
      // 1. Already claimed
      // 2. Pre-fix cleanup (needs manual reward distribution)
      if (isPreFixCleanup) {
        // Pre-fix cleanup: clear from localStorage and return null
        // User needs to contact support or use manual reward distribution script
        console.warn('[verification] 🚫 Pre-fix cleanup detected, clearing from localStorage and hiding claim button')
        clearPendingCleanup(user)
        // Also mark it as claimed locally to prevent it from showing again
        markCleanupAsClaimed(user, cleanupId)
        return null
      } else {
        // Already claimed - clear pending and return null
        console.log('[verification] Cleanup already claimed, clearing from localStorage')
        clearPendingCleanup(user)
        return null
      }
    }

    return {
      cleanupId,
      verified,
      rejected,
      claimed,
      canClaim,
    }
  } catch (err) {
    console.error('[verification] Failed to load cleanup details:', err)
    return null
  }
}

/**
 * getUserCleanupStatus
 *
 * Main UI helper:
 * - Can submit?
 * - Can claim?
 * - Is locked?
 */
export async function getUserCleanupStatus(user: Address): Promise<{
  hasPendingCleanup: boolean
  canSubmit: boolean
  canClaim: boolean
  cleanupId?: bigint
  level?: number
  reason?: string
}> {
  const latest = await getLatestCleanupStatus(user)

  if (!latest) {
    return {
      hasPendingCleanup: false,
      canSubmit: true,
      canClaim: false,
    }
  }

  if (latest.rejected) {
    return {
      hasPendingCleanup: false,
      canSubmit: true,
      canClaim: false,
      reason: 'Your cleanup was rejected. Please submit a new one.',
    }
  }

  if (!latest.verified) {
    return {
      hasPendingCleanup: true,
      canSubmit: false,
      canClaim: false,
      cleanupId: latest.cleanupId,
      reason: 'Your cleanup is under review.',
    }
  }

  if (latest.canClaim) {
    // Get cleanup details to fetch the level
    let level = 1 // Default level
    try {
      if (latest.cleanupId !== undefined) {
        const details = await getCleanupDetails(latest.cleanupId)
        level = details.level || 1
      }
    } catch (error) {
      console.warn('[verification] Could not fetch cleanup level, using default:', error)
    }
    
    return {
      hasPendingCleanup: true,
      canSubmit: false,
      canClaim: true,
      cleanupId: latest.cleanupId,
      level,
    }
  }

  // Verified + already claimed
  return {
    hasPendingCleanup: false,
    canSubmit: true,
    canClaim: false,
  }
}

/**
 * canClaimLevel
 *
 * Kept ONLY for UI compatibility.
 * ImpactProductNFT is disabled in this milestone.
 */
export async function canClaimLevel(
  user: Address
): Promise<{ canClaim: boolean; reason?: string }> {
  const status = await getUserCleanupStatus(user)

  if (!status.canClaim) {
    return {
      canClaim: false,
      reason: status.reason ?? 'Nothing to claim.',
    }
  }

  return { canClaim: true }
}
