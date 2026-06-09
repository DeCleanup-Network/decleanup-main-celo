import type { Metadata } from 'next'
import { buildPageMetadata, metadataBase } from '@/lib/seo/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>
}): Promise<Metadata> {
  const { address: rawParam } = await params
  const raw = decodeURIComponent(rawParam || '').trim()
  const short =
    raw.startsWith('0x') && raw.length > 12 ? `${raw.slice(0, 6)}…${raw.slice(-4)}` : raw.slice(0, 18)

  const title = `Impact Portfolio · ${short}`
  const description =
    'Verified onchain impact, DCU rewards, and cleanup evidence on DeCleanup Rewards.'

  return {
    ...buildPageMetadata({
      title,
      description,
      path: `/impact/${encodeURIComponent(raw)}`,
    }),
    metadataBase: metadataBase(),
    openGraph: {
      title: `DeCleanup Rewards · Impact Portfolio · ${short}`,
      description,
      url: `/impact/${encodeURIComponent(raw)}`,
      siteName: 'DeCleanup Rewards',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `DeCleanup Rewards · Impact Portfolio · ${short}`,
      description,
    },
  }
}

export default function ImpactAddressLayout({ children }: { children: React.ReactNode }) {
  return children
}
