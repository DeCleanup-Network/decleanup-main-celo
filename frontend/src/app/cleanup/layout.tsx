import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Submit cleanup',
  path: '/cleanup',
  noIndex: true,
})

export default function CleanupLayout({ children }: { children: React.ReactNode }) {
  return children
}
