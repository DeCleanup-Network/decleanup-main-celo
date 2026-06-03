import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  title: 'Dashboard',
  description: 'Your DeCleanup Rewards activity and submissions.',
  path: '/dashboard',
  noIndex: true,
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
