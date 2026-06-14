'use client'

import Link from 'next/link'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/** Shown on Account settings until passkey and biometrics (if supported) are done. */
export function AccountSetupIntro() {
  return (
    <section className="rounded-xl border border-amber-700/35 bg-amber-950/15 p-4 text-sm leading-relaxed text-amber-100/90">
      <p>
        Before using the app, set up your {WALLET_PASSKEY_LOWER}. On a new device, sign in with the same Google or
        email account, then enter your {WALLET_PASSKEY_LOWER} to unlock. Read more in{' '}
        <Link href="/guide#embedded-wallet" className="text-brand-green hover:underline">
          How it works
        </Link>
        .
      </p>
    </section>
  )
}
