import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
}

/** Minimal shell when the network is unavailable (precached by Serwist). */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
        You&apos;re offline
      </h1>
      <p className="text-sm text-muted-foreground">
        DeCleanup Rewards needs a connection for login, wallets, and cleanups. Reconnect, then
        refresh.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-brand-green/40 bg-brand-green/10 px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/20"
      >
        Try home
      </Link>
    </div>
  )
}
