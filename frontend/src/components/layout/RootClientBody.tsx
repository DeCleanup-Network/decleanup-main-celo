'use client'

import { Providers } from '@/lib/providers'
import { NetworkChecker } from '@/components/network/NetworkChecker'
import { Header } from '@/components/layout/Header'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'

/**
 * Loaded via next/dynamic from app/layout so the layout chunk stays small.
 * Wallet/Web3Auth/Torus deps live here, not in app/layout.js — avoids ChunkLoadError timeouts on huge single chunks.
 */
export default function RootClientBody({ children }: { children: React.ReactNode }) {
  return (
    <RootErrorBoundary>
      <Providers>
        <NetworkChecker />
        <Header />
        <main className="flex-1 pb-mobile-safe">{children}</main>
      </Providers>
    </RootErrorBoundary>
  )
}
