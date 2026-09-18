import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Sponsor a cleanup',
  description:
    'Send cUSD on Celo to fund a verified DeCleanup event. Works in MiniPay and WalletConnect.',
  path: '/sponsor',
})

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return children
}
