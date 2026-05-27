'use client'

import { Providers } from '@/lib/providers'
import { NetworkChecker } from '@/components/network/NetworkChecker'
import { Header } from '@/components/layout/Header'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { useAutoSwitchToAppChain } from '@/hooks/useAutoSwitchToAppChain'
import { usePathname } from 'next/navigation'

function AutoSwitchToAppChain() {
  useAutoSwitchToAppChain()
  return null
}

/**
 * Loaded via next/dynamic from app/layout so the layout chunk stays small.
 * Wallet/Privy deps live here, not in app/layout.js — avoids ChunkLoadError timeouts on huge single chunks.
 */
export default function RootClientBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showGlobalFooter = pathname !== '/'

  return (
    <RootErrorBoundary>
      <Providers>
        <AutoSwitchToAppChain />
        <NetworkChecker />
        <Header />
        <main className="flex-1 pb-mobile-safe">{children}</main>
        {showGlobalFooter ? (
          <footer className="border-t border-border bg-background/80 py-5">
            <div className="mx-auto flex w-full max-w-[1200px] items-center justify-center gap-2 px-4 text-sm text-muted-foreground sm:text-base">
              <span className="font-medium">Built on</span>
              <img
                src="/celo-celo-logo.svg"
                alt="Celo"
                className="h-5 w-auto rounded-sm sm:h-6"
              />
            </div>
          </footer>
        ) : null}
      </Providers>
    </RootErrorBoundary>
  )
}
