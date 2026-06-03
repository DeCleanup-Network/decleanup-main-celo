/** Canonical public origin for SEO, sitemap, OG, and WebAuthn (no trailing slash). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://dapp.decleanup.net'
  return raw.replace(/\/$/, '')
}

export const SITE_NAME = 'DeCleanup Rewards'

export const SITE_DEFAULT_TITLE =
  'DeCleanup Rewards | Verified environmental cleanups on Celo'

export const SITE_DEFAULT_DESCRIPTION =
  'DeCleanup Rewards lets you log cleanups, earn verified onchain impact, DCU points, and $cDCU on Celo. Join the global cleanup movement.'

export const SITE_KEYWORDS = [
  'DeCleanup Rewards',
  'DeCleanup',
  'environmental cleanup',
  'verified impact',
  'Celo',
  'blockchain cleanup',
  'DCU',
  'cDCU',
  'Impact Product',
  'hypercerts',
  'community cleanup',
] as const

/** Default social preview (Pinata gateway). */
export const SITE_OG_IMAGE_URL =
  'https://gateway.pinata.cloud/ipfs/bafybeicdkbybpazpp6ucfbfbrrido36ka5v7hslanbem4vsbfrznrf4kzm?filename=DCUSocialNEW.png'
