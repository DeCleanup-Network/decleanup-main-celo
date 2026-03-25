import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impact Portfolio',
  description: 'Verified onchain impact, DCU rewards breakdown, and cleanup evidence from DeCleanup.',
}

export default function ImpactAddressLayout({ children }: { children: React.ReactNode }) {
  return children
}
