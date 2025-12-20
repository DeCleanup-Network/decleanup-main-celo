/**
 * Generate a referral link for the given address
 * @param address - User's wallet address
 * @param platform - Platform identifier (for tracking)
 * @returns Full referral URL
 */
export function generateReferralLink(address: string, platform: string = 'web'): string {
    if (typeof window === 'undefined') {
        return `https://decleanup.network?ref=${address}`
    }
    return `${window.location.origin}?ref=${address}&utm_source=${platform}`
}

/**
 * Format a message for sharing impact achievements
 * @param level - User's current level
 * @param link - Referral link to share
 * @param platform - Platform being shared to
 * @returns Formatted share message
 */
export function formatImpactShareMessage(level: number, link: string, platform: string = 'web'): string {
    return `Check out my Level ${level} Impact Product on DeCleanup Rewards! Join me in making a real environmental impact. 🌱

🔗 ${link}`
}

/**
 * Share on X (Twitter)
 * @param text - Text to share
 * @param link - Link to include
 */
export function shareOnX(text: string, link: string): void {
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(link)
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank')
}

/**
 * Share on Farcaster
 * @param text - Text to share (will include link)
 */
export function shareOnFarcaster(text: string): void {
    const encodedText = encodeURIComponent(text)
    window.open(`https://warpcast.com/~/compose?text=${encodedText}`, '_blank')
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use shareOnFarcaster instead
 */
export async function shareCast(text: string, link: string): Promise<void> {
    shareOnFarcaster(`${text}\n\n${link}`)
}

