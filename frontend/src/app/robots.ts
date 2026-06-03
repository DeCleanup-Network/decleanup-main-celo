import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

/** Crawl rules for Google and other search engines. */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard',
        '/wallet',
        '/profile',
        '/cleanup',
        '/login',
        '/import-wallet',
        '/recovery',
        '/create-hypercert',
        '/verifier',
      ],
    },
    host: base,
    sitemap: `${base}/sitemap.xml`,
  }
}
