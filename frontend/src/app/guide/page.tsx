import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { UserGuideView } from '@/components/guide/UserGuideView'

export const metadata: Metadata = buildPageMetadata({
  title: 'User Guide',
  description:
    'How to sign in, submit cleanups, and earn rewards on DeCleanup: Celo for the full app, Base for the simple cleanup path.',
  path: '/guide',
})

export default function UserGuidePage() {
  return <UserGuideView />
}
