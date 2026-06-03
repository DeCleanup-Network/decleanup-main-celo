import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Account settings',
  description: 'Manage your DeCleanup Rewards embedded wallet and account security.',
  path: '/wallet',
  noIndex: true,
})

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children
}
