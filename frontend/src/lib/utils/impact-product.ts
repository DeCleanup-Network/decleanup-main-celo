/**
 * Impact Product Utilities
 * Helper functions for Impact Product metadata and display
 */

export type LevelName = 'Newbie' | 'Pro' | 'Hero' | 'Guardian'

/**
 * Get level name based on level number
 */
export function getLevelName(level: number): LevelName {
  if (level >= 1 && level <= 3) return 'Newbie'
  if (level >= 4 && level <= 6) return 'Pro'
  if (level >= 7 && level <= 9) return 'Hero'
  if (level >= 10) return 'Guardian'
  return 'Newbie'
}

/**
 * Get impact value range based on level
 */
export function getImpactValueRange(level: number): string {
  if (level >= 1 && level <= 3) return '1-3'
  if (level >= 4 && level <= 6) return '4-6'
  if (level >= 7 && level <= 9) return '7-9'
  if (level >= 10) return '10+'
  return '0'
}

/**
 * Get image path for a level (local fallback)
 * Images should be stored in /public/impact-products/ as IP1.png, IP2.png, ..., IP10.png
 * For level 10, also has IP10.gif for animation
 * 
 * Note: Prefer IPFS URLs when available. This is a fallback for local development.
 */
export function getImpactProductImagePath(level: number): string {
  if (level < 1 || level > 10) return '/impact-products/IP1.png'
  return `/impact-products/IP${level}.png`
}

/**
 * Get animation path for level 10 (local fallback)
 * 
 * Note: Prefer IPFS URLs when available. This is a fallback for local development.
 */
export function getImpactProductAnimationPath(): string {
  return '/impact-products/IP10.gif'
}

/**
 * Get IPFS image URL for a level
 * Uses environment variable for IPFS CID or falls back to local path
 */
export function getImpactProductIPFSImageUrl(level: number, ipfsCid?: string): string {
  if (ipfsCid) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    return `${gateway}${ipfsCid}/IP${level}.png`
  }
  // Fallback to local path
  return getImpactProductImagePath(level)
}

/**
 * Get IPFS animation URL for level 10
 * Uses environment variable for IPFS CID or falls back to local path
 */
export function getImpactProductIPFSAnimationUrl(ipfsCid?: string): string {
  if (ipfsCid) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    return `${gateway}${ipfsCid}/IP10.gif`
  }
  // Fallback to local path
  return getImpactProductAnimationPath()
}

/**
 * Level progression table
 */
export const LEVEL_PROGRESSION = [
  { cleanups: '1-3', impactValue: '1-3', level: 'Newbie' },
  { cleanups: '4-6', impactValue: '4-6', level: 'Pro' },
  { cleanups: '7-9', impactValue: '7-9', level: 'Hero' },
  { cleanups: '10+', impactValue: '10+', level: 'Guardian' },
] as const

/**
 * Constant traits for Impact Products
 * These match the attributes in the metadata JSON files
 */
export const CONSTANT_TRAITS = {
  type: 'Dynamic',
  impact: 'Environment',
  category: 'Cleanup NFT',
  rarity: 'Unique',
} as const

