import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Profile',
  path: '/profile',
  noIndex: true,
})

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
