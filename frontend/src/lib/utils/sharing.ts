/** Public dapp origin for share/referral links (env in prod, current origin in dev when unset). */
export function getDappOriginForLinks(): string {
    if (typeof window !== 'undefined') {
        const fromEnv = process.env.NEXT_PUBLIC_WEB_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
        if (fromEnv) return fromEnv.replace(/\/$/, '')
        return window.location.origin.replace(/\/$/, '')
    }
    return (
        process.env.NEXT_PUBLIC_WEB_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://dapp.decleanup.net'
    ).replace(/\/$/, '')
}

/**
 * Generate a referral link for the given address (canonical EOA public identity).
 */
export function generateReferralLink(address: string, _platform: string = 'web'): string {
    return `${getDappOriginForLinks()}?ref=${address}`
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
 * Open Warpcast compose with pre-filled text (include your link in the string).
 */
export function shareOnFarcaster(text: string): void {
    const encoded = encodeURIComponent(text)
    window.open(`https://warpcast.com/~/compose?text=${encoded}`, '_blank', 'noopener,noreferrer')
}
