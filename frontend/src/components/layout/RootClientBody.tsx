'use client'

import { Providers } from '@/lib/providers'
import { NetworkChecker } from '@/components/network/NetworkChecker'
import { Header } from '@/components/layout/Header'
import { SiteFooterLinks } from '@/components/layout/SiteFooterLinks'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery'
import { HypercertPublishedNotifier } from '@/components/hypercerts/HypercertPublishedNotifier'
import { useAutoSwitchToAppChain } from '@/hooks/useAutoSwitchToAppChain'
import { usePathname } from 'next/navigation'
import type { State } from 'wagmi'

function AutoSwitchToAppChain() {
  useAutoSwitchToAppChain()
  return null
}

/**
 * Loaded via next/dynamic from app/layout so the layout chunk stays small.
 * Wallet/Privy deps live here, not in app/layout.js — avoids ChunkLoadError timeouts on huge single chunks.
 */
export default function RootClientBody({
  children,
  wagmiInitialState,
}: {
  children: React.ReactNode
  wagmiInitialState?: State
}) {
  const pathname = usePathname()
  const showGlobalFooter = pathname !== '/'

  return (
    <RootErrorBoundary>
      <Providers wagmiInitialState={wagmiInitialState}>
        <div className="flex min-h-screen flex-col">
          <ChunkLoadRecovery />
          <HypercertPublishedNotifier />
          <AutoSwitchToAppChain />
          <NetworkChecker />
          <Header />
          <main className="flex min-h-0 flex-1 flex-col bg-background pb-mobile-safe">{children}</main>
          {showGlobalFooter ? (
            <footer className="border-t border-white/10 bg-background/80 py-6">
              <div className="container mx-auto flex flex-col items-center gap-4 px-4">
                <SiteFooterLinks />
                <div className="font-meta flex items-center justify-center gap-2 opacity-50">
                  <span>Built on</span>
                  <img src="/celo-celo-logo.svg" alt="Celo" className="h-5 w-auto rounded-sm sm:h-6" />
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      </Providers>
    </RootErrorBoundary>
  )
}
