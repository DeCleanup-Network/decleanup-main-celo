import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

/** Public marketing and program pages (auth-gated routes are excluded). */
const PUBLIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/guide', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/leaderboard', changeFrequency: 'daily', priority: 0.85 },
  { path: '/hypercerts', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/airdrop', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/staking', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const lastModified = new Date()

  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
