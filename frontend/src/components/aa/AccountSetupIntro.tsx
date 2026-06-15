'use client'

import Link from 'next/link'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

/** Shown on Account settings until wallet passcode is set. */
export function AccountSetupIntro() {
  return (
    <section className="rounded-xl border border-amber-700/35 bg-amber-950/15 p-4 text-sm leading-relaxed text-amber-100/90">
      <p>
        Pick 6 digits for your {WALLET_PASSCODE_LOWER}. On a new device, sign in with the same Google or
        email account, then enter the same passcode. Optionally export your signer key to MetaMask when you
        are ready.{' '}
        <Link href="/guide#embedded-wallet" className="text-brand-green hover:underline">
          How it works
        </Link>
        .
      </p>
    </section>
  )
}
