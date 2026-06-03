import {
  getSiteUrl,
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE_URL,
} from '@/lib/site'

/** Structured data for Google rich results (WebSite + WebApplication). */
export function SiteJsonLd() {
  const url = getSiteUrl()

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${url}/#website`,
      url,
      name: SITE_NAME,
      description: SITE_DEFAULT_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${url}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${url}/#organization`,
      name: 'DeCleanup Network',
      url: 'https://decleanup.net',
      logo: SITE_OG_IMAGE_URL,
    },
    {
      '@type': 'WebApplication',
      '@id': `${url}/#app`,
      name: SITE_NAME,
      url,
      description: SITE_DEFAULT_DESCRIPTION,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript and a modern browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) }}
    />
  )
}
