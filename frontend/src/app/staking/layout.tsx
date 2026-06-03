import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Staking',
  description: 'Stake and earn with DeCleanup Rewards on Celo.',
  path: '/staking',
})

export default function StakingLayout({ children }: { children: React.ReactNode }) {
  return children
}
