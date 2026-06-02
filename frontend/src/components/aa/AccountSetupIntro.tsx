'use client'

import Link from 'next/link'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/** Shown on Account settings until passkey, biometrics (if supported), and backup are done. */
export function AccountSetupIntro() {
  return (
    <section className="rounded-xl border border-amber-700/35 bg-amber-950/15 p-4 text-sm leading-relaxed text-amber-100/90">
      <p>
        Before using the app, set up your {WALLET_PASSKEY_LOWER} and download a backup file (recommended).
        Read more about your wallet security in{' '}
        <Link href="/guide#embedded-wallet" className="text-brand-green hover:underline">
          How it works
        </Link>
        .
      </p>
    </section>
  )
}
