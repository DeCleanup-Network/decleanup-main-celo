'use client'

import Link from 'next/link'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-brand-green/20 bg-black/95 backdrop-blur-md">
            <div className="container mx-auto px-3 sm:px-4 lg:px-8">
                <div className="flex h-16 sm:h-20 items-center justify-between gap-2">
                    {/* Logo & Title */}
                    <Link href="/" className="group flex items-center gap-2 sm:gap-3 transition-all hover:scale-105">
                        <img 
                            src="/logo.png" 
                            alt="DeCleanup Network" 
                            className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0"
                        />
                        <p className="font-bebas text-[10px] sm:text-[11px] leading-none tracking-wide text-gray-300 lg:text-[12px] whitespace-nowrap">
                            CLEAN UP, SNAP, EARN
                        </p>
                    </Link>

                    {/* Persistent pill: Full Platform [Celo] — Geist Sans for nav/badge */}
                    <span className="font-sans inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium text-brand-green shrink-0">
                        Full Platform
                        <span className="rounded bg-brand-green/20 px-1.5 py-0.5 font-semibold uppercase">Celo</span>
                    </span>

                    {/* Wallet Connect */}
                    <WalletConnect />
                </div>
            </div>
        </header>
    )
}
