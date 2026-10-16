import type { Metadata } from 'next'
import { ProofPublicChrome } from '@/components/proof/ProofPublicChrome'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Check a cleanup',
  description:
    'Public proof of verified DeCleanup records on Celo. No account required.',
  path: '/proof',
})

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return <ProofPublicChrome>{children}</ProofPublicChrome>
}
