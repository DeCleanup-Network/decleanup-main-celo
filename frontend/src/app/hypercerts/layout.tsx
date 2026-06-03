import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Hypercerts',
  description:
    'Bundle verified cleanups into Hypercerts on DeCleanup Rewards and Celo.',
  path: '/hypercerts',
})

export default function HypercertsLayout({ children }: { children: React.ReactNode }) {
  return children
}
