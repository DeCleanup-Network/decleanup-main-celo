'use client'

import Link from 'next/link'

/**
 * Shown when WalletConnect / EmbeddedWalletConnect throws (e.g. provider not ready).
 * Prevents the whole header and page from breaking.
 */
export function WalletConnectFallback() {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <span className="text-xs text-gray-500">Wallet unavailable</span>
      <Link
        href="/reset-wallet-session"
        className="text-xs text-brand-green underline hover:no-underline"
      >
        Reset session
      </Link>
    </div>
  )
}
