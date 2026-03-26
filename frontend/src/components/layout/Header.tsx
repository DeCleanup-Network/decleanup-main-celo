'use client'

import Link from 'next/link'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { WalletErrorBoundary } from '@/features/wallet/components/WalletErrorBoundary'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-green/20 bg-black/95 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-3 min-w-0">
          <Link
            href="/"
            className="group flex min-w-0 flex-shrink-0 items-center transition-transform hover:scale-[1.02]"
            aria-label="DeCleanup home"
          >
            <img
              src="/logo.png"
              alt="DeCleanup Network"
              className="h-10 w-10 sm:h-11 sm:w-11"
            />
          </Link>

          <div className="min-w-0 flex-shrink flex justify-end">
            <WalletErrorBoundary>
              <WalletConnect />
            </WalletErrorBoundary>
          </div>
        </div>
      </div>
    </header>
  )
}
