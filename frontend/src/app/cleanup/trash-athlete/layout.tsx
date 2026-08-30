import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Trash Athlete Challenge',
  path: '/cleanup/trash-athlete',
  noIndex: true,
})

export default function TrashAthleteLayout({ children }: { children: React.ReactNode }) {
  return children
}
