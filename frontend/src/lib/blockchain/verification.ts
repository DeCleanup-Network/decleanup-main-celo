import { Address } from 'viem'
import {
  getCleanupDetailsFresh,
  findLatestClaimableCleanup,
  getUserSubmissions,
} from './contracts'

/** Verified submissions (approved, not rejected) for this user — drives level claim eligibility vs NFT userLevel. */
export async function countVerifiedCleanupsForUser(user: Address): Promise<number> {
  const submissionIds = await getUserSubmissions(user)
  if (submissionIds.length === 0) return 0
  const detailsList = await Promise.all(submissionIds.map((sid) => getCleanupDetailsFresh(sid)))
  let n = 0
  for (const d of detailsList) {
    if (d.verified && !d.rejected) n++
  }
  return n
}

/** True if user still has at least one verified cleanup whose Impact Product level was not minted yet (NFT level is behind verified count). */
export async function isImpactClaimOutstanding(user: Address): Promise<boolean> {
  const verifiedCount = await countVerifiedCleanupsForUser(user)
  if (verifiedCount === 0) return false
  const { getUserLevelFresh } = await import('./contracts')
  const nftLevel = await getUserLevelFresh(user)
  return nftLevel < verifiedCount
}

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

export function unmarkCleanupClaimed(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  const key = claimedKey(user)
  const claimed = getClaimedCleanupIds(user)
  const cleanupIdStr = cleanupId.toString()
  const filtered = claimed.filter((id) => id !== cleanupIdStr)
  if (filtered.length === claimed.length) return
  if (filtered.length === 0) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, JSON.stringify(filtered))
  }
  console.log('[verification] Cleared stale claimed flag:', { user, cleanupId: cleanupIdStr })
}

export function isCleanupClaimed(user: Address, cleanupId: bigint): boolean {
  const claimed = getClaimedCleanupIds(user)
  return claimed.includes(cleanupId.toString())
}

/**
 * Local claimed flags can be stale (e.g. old pre-fix bug). On-chain NFT level wins:
 * if NFT level is still behind verified count, treat as unclaimed and clear the flag.
 */
export async function isCleanupClaimedEffective(
  user: Address,
  cleanupId: bigint
): Promise<boolean> {
  if (!isCleanupClaimed(user, cleanupId)) return false
  const verifiedCount = await countVerifiedCleanupsForUser(user)
  const { getUserLevelFresh } = await import('./contracts')
  const nftLevel = await getUserLevelFresh(user)
  if (verifiedCount > 0 && nftLevel < verifiedCount) {
    unmarkCleanupClaimed(user, cleanupId)
    console.log('[verification] Ignoring stale local claimed — NFT level still behind verified count', {
      cleanupId: cleanupId.toString(),
      nftLevel,
      verifiedCount,
    })
    return false
  }
  return true
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
        cleanupId = foundCleanupId
        console.log('[verification] Found claimable cleanup from contract:', cleanupId.toString())
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
    const localClaimed = await isCleanupClaimedEffective(user, cleanupId)
    if (localClaimed) {
      console.log('[verification] Cleanup in localStorage is already claimed, clearing it')
      clearPendingCleanup(user)
      return null
    }
  }

  // Strict submit -> verify -> claim loop:
  // only the latest submission can be considered claimable.
  // If localStorage still points to an older submission, clear it and block claim UI.
  if (cleanupId !== null && cleanupId !== undefined) {
    try {
      const { getUserSubmissions } = await import('@/lib/blockchain/contracts')
      const submissions = await getUserSubmissions(user)
      if (submissions.length > 0) {
        const latestSubmissionId = [...submissions].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0]
        if (cleanupId !== latestSubmissionId) {
          console.log('[verification] Pending cleanup is not latest submission; clearing stale pending ID', {
            pendingCleanupId: cleanupId.toString(),
            latestSubmissionId: latestSubmissionId.toString(),
          })
          clearPendingCleanup(user)
          return null
        }
      }
    } catch (err) {
      console.warn('[verification] Failed latest-submission check for pending cleanup:', err)
    }
  }
  
  // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
  if (cleanupId === null || cleanupId === undefined) {
    console.log('[verification] No cleanup ID found, returning null')
    return null
  }

  try {
    const details = await getCleanupDetailsFresh(cleanupId)
    
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
    const localClaimed = await isCleanupClaimedEffective(user, cleanupId)
    const claimed = localClaimed

    // Claim eligibility: verified, not rejected, not locally claimed.
    // NFT level vs verified count (below) is the on-chain source of truth — not rewarded/balance heuristics.
    let canClaim = verified && !rejected && !claimed

    // On-chain source of truth: each verified cleanup should eventually mint one Impact Product level.
    // localStorage "claimed" can be missing (new device / cleared storage) while NFT level already caught up.
    if (canClaim && verified) {
      try {
        const verifiedCount = await countVerifiedCleanupsForUser(user)
        const { getUserLevelFresh } = await import('./contracts')
        const nftLevel = await getUserLevelFresh(user)
        if (verifiedCount > 0 && nftLevel >= verifiedCount) {
          console.log('[verification] NFT level caught up with verified cleanups; treating as claimed', {
            nftLevel,
            verifiedCount,
            cleanupId: cleanupId.toString(),
          })
          clearPendingCleanup(user)
          markCleanupAsClaimed(user, cleanupId)
          return null
        }
      } catch (e) {
        console.warn('[verification] NFT vs verified count check failed:', e)
      }
    }

    // Debug: Log why canClaim might be false
    if (verified && !canClaim) {
      console.warn('[verification] ⚠️ Cleanup is verified but canClaim is false:', {
        cleanupId: cleanupId.toString(),
        verified,
        rejected,
        claimed,
        reason: rejected ? 'rejected' : claimed ? 'claimed' : 'unknown',
      })
    } else if (verified && canClaim) {
      console.log('[verification] ✅ Cleanup is verified and canClaim is true - claim button should appear')
    }
    
    console.log('[verification] Status calculation:', {
      verified,
      rejected,
      contractClaimed: details.claimed,
      localClaimed,
      claimed,
      canClaim,
    })

    // Recyclables are rewarded onchain as part of impact report (5 DCU total per submission for impact and/or recyclables)

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
      storePendingCleanup(user, cleanupId)
    } else if (verified && !canClaim) {
      console.log('[verification] Cleanup already claimed, clearing from localStorage')
      clearPendingCleanup(user)
      return null
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
  // Check user level first - if level 10, cannot submit more cleanups
  let userLevel = 0
  try {
    const { getUserLevel } = await import('./contracts')
    userLevel = await getUserLevel(user)
  } catch (error) {
    console.warn('[verification] Could not fetch user level:', error)
  }

  if (userLevel >= 10) {
    return {
      hasPendingCleanup: false,
      canSubmit: false,
      canClaim: false,
      reason: 'You have reached the maximum level (10). No more cleanups can be submitted at this time.',
    }
  }

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
        const details = await getCleanupDetailsFresh(latest.cleanupId)
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
