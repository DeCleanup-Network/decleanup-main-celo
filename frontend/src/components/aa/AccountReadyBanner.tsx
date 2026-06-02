'use client'

import Link from 'next/link'

/** Shown after auto wallet creation; points users to Account settings before submitting. */
export function AccountReadyBanner() {
  return (
    <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-gray-200">
      Account ready. Optional:{' '}
      <Link href="/wallet" className="font-medium text-brand-green underline underline-offset-2">
        Account settings
      </Link>
      .
    </div>
  )
}
