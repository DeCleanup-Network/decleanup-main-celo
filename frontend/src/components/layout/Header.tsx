'use client'

import Link from 'next/link'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { WalletErrorBoundary } from '@/features/wallet/components/WalletErrorBoundary'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-green/20 bg-black/95 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex h-14 sm:h-16 md:h-20 items-center justify-between gap-2 min-w-0">
          {/* Logo & Title: min-w-0 so text can shrink; hide tagline on xs if needed */}
          <Link href="/" className="group flex min-w-0 flex-shrink items-center gap-2 transition-all hover:scale-105 sm:gap-3">
            <img
              src="/logo.png"
              alt="DeCleanup Network"
              className="h-10 w-10 flex-shrink-0 sm:h-12 sm:w-12 md:h-16 md:w-16"
            />
            <p className="truncate font-bebas text-[10px] leading-none tracking-wide text-gray-300 sm:text-[11px] lg:text-[12px]">
              CLEAN UP, SNAP, EARN
            </p>
          </Link>

          {/* Pill: hidden on very small screens to avoid overlap with wallet */}
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 font-sans text-[10px] font-medium text-brand-green sm:inline-flex md:px-3 md:py-1.5 md:text-xs">
            Full Platform
            <span className="rounded bg-brand-green/20 px-1.5 py-0.5 font-semibold uppercase">Celo</span>
          </span>

          <div className="flex-shrink-0">
            <WalletErrorBoundary>
              <WalletConnect />
            </WalletErrorBoundary>
          </div>
        </div>
      </div>
    </header>
  )
}
