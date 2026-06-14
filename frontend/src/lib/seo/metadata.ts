import type { Metadata } from 'next'
import {
  getSiteUrl,
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_OG_IMAGE_URL,
} from '@/lib/site'

export const metadataBase = () => new URL(getSiteUrl())

export function siteOpenGraph(
  title: string,
  description: string,
  path = '/'
): NonNullable<Metadata['openGraph']> {
  const base = getSiteUrl()
  return {
    title,
    description,
    url: path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`,
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: SITE_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  }
}

export function siteTwitter(title: string, description: string): Metadata['twitter'] {
  return {
    card: 'summary_large_image',
    title,
    description,
    images: [SITE_OG_IMAGE_URL],
  }
}

export function buildPageMetadata(options: {
  title: string
  description?: string
  path?: string
  /** When true, omit from Google index (auth, wallet, admin). */
  noIndex?: boolean
}): Metadata {
  const description = options.description ?? SITE_DEFAULT_DESCRIPTION
  const path = options.path ?? '/'
  const canonical = path.startsWith('http') ? path : path.startsWith('/') ? path : `/${path}`

  return {
    title: options.title,
    description,
    alternates: { canonical },
    keywords: [...SITE_KEYWORDS],
    openGraph: siteOpenGraph(options.title, description, canonical),
    twitter: siteTwitter(options.title, description),
    robots: options.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
  }
}

export function rootSiteMetadata(): Metadata {
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim()

  return {
    metadataBase: metadataBase(),
    title: {
      default: SITE_DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [...SITE_KEYWORDS],
    authors: [{ name: 'DeCleanup Network', url: 'https://decleanup.net' }],
    creator: 'DeCleanup Network',
    publisher: 'DeCleanup Network',
    category: 'technology',
    alternates: {
      canonical: '/',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: [
        { url: '/icon.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: SITE_NAME,
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: siteOpenGraph(SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION, '/'),
    twitter: siteTwitter(SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION),
    verification: googleVerification ? { google: googleVerification } : undefined,
    other: {
      'mobile-web-app-capable': 'yes',
    },
  }
}
