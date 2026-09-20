import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Sponsor a cleanup',
  description:
    'Browse cleanup campaigns, open a shareable page, then donate with cUSD on Celo.',
  path: '/sponsor',
})

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return children
}
