import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Leaderboard',
  description:
    'See top DeCleanup Rewards participants by verified impact and DCU on Celo.',
  path: '/leaderboard',
})

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
