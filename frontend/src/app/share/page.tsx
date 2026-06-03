import type { Metadata } from 'next'
import { ShareRedirect } from '@/components/share/ShareRedirect'
import { getSiteUrl } from '@/lib/site'

// Preview image for sharing (used for both referral and claim)
const SHARE_IMAGE_URL =
    'https://gateway.pinata.cloud/ipfs/bafybeic5xwp2kpoqvc24uvl5upren5t5h473upqxyuu2ui3jedtvruzhru?filename=social.png'

const SITE_URL = getSiteUrl()

function buildQueryString(params: Record<string, string | undefined>) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            query.set(key, value)
        }
    })
    const queryString = query.toString()
    return queryString ? `?${queryString}` : ''
}

// This page handles sharing with proper OG tags for social media previews
// It renders HTML with meta tags so crawlers can read them, then redirects client-side
export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}): Promise<Metadata> {
    const params = await searchParams
    const ref = params.ref
    const type = params.type || 'referral' // 'referral' or 'claim'
    const level = params.level

    let title = 'DeCleanup Rewards - Earn Tokens for Cleanups on Celo'
    let description = 'Clean up, share proof, earn tokens, and trade on Celo.'
    const imageUrl = SHARE_IMAGE_URL // Same preview image for both referral and claim

    if (type === 'claim' && level) {
        title = `Just minted Level ${level} Impact Product! - DeCleanup Rewards`
        description = `Just minted Level ${level} Impact Product for my recent cleanup. Earn tokens and trade on Celo with DeCleanup Rewards.`
    } else if (type === 'referral') {
        title = 'Join DeCleanup Rewards — Log cleanups. Verified impact onchain.'
        description = 'Join me in DeCleanup Rewards! Clean up, share proof, earn tokens, and trade on Celo.'
    }

    const shareQuery = buildQueryString({ ref, type, level })
    const shareUrl = `${SITE_URL}/share${shareQuery}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: shareUrl,
            siteName: 'DeCleanup Rewards',
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
            locale: 'en_US',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
        // Add explicit meta tags for better crawler support
        other: {
            'og:image': imageUrl,
            'og:image:width': '1200',
            'og:image:height': '630',
            'og:image:type': 'image/png',
            'twitter:image': imageUrl,
            'twitter:image:alt': title,
        },
    }
}

export default async function SharePage({
    searchParams,
}: {
    searchParams: Promise<{ ref?: string; type?: string; level?: string }>
}) {
    const params = await searchParams
    const ref = params.ref
    const type = params.type || 'referral'

    const redirectUrl = (() => {
        const url = new URL(SITE_URL)

        if (type === 'referral' && ref) {
            url.pathname = '/cleanup'
            url.searchParams.set('ref', ref)
            return url.toString()
        }

        if (type === 'claim') {
            url.pathname = '/profile'
            url.search = ''
            return url.toString()
        }

        return url.toString()
    })()

    // Render page with meta tags, then redirect client-side
    // This allows crawlers to read the OG tags before redirect
    return <ShareRedirect redirectUrl={redirectUrl} />
}
