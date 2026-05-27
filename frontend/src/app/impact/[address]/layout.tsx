import type { Metadata } from 'next'

const SITE_URL =
  process.env.NEXT_PUBLIC_WEB_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://dapp.decleanup.net'

export async function generateMetadata({
  params,
}: {
  params: { address: string }
}): Promise<Metadata> {
  const raw = decodeURIComponent(params.address || '').trim()
  const short =
    raw.startsWith('0x') && raw.length > 12 ? `${raw.slice(0, 6)}…${raw.slice(-4)}` : raw.slice(0, 18)

  const title = `Impact Portfolio · ${short}`
  const description =
    'Verified onchain impact, DCU rewards, and cleanup evidence — DeCleanup Impact Portfolio.'

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      title: 'DeCleanup Rewards — Impact Portfolio',
      description,
      url: `/impact/${encodeURIComponent(raw)}`,
      siteName: 'DeCleanup Rewards',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'DeCleanup Rewards — Impact Portfolio',
      description,
    },
  }
}

export default function ImpactAddressLayout({ children }: { children: React.ReactNode }) {
  return children
}
