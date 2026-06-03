import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Past Contributor Airdrop',
  description:
    'Check eligibility and claim $cDCU from the DeCleanup Rewards past contributor airdrop on Celo.',
  path: '/airdrop',
})

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return children
}
