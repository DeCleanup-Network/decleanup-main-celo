'use client'

import Link from 'next/link'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { WalletErrorBoundary } from '@/features/wallet/components/WalletErrorBoundary'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex h-[4.5rem] sm:h-[5.5rem] items-center justify-between gap-3 min-w-0">
          <Link
            href="/"
            className="group flex min-w-0 flex-shrink-0 items-center transition-transform hover:scale-[1.02]"
            aria-label="DeCleanup Rewards home"
          >
            <img
              src="/logo.png"
              alt="DeCleanup Network"
              className="h-14 w-14 sm:h-16 sm:w-16"
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
