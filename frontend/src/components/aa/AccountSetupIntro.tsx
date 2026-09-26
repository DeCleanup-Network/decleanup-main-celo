'use client'

import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

/** Shown on Account settings until account passcode is set. */
export function AccountSetupIntro() {
  return (
    <section className="rounded-xl border border-amber-700/35 bg-amber-950/15 p-4 text-sm leading-relaxed text-amber-100/90">
      <p>
        Pick 6 digits for your {WALLET_PASSCODE_LOWER}. On a new device, sign in with the same Google or
        email account, then enter the same passcode. Optionally export your signer key to MetaMask when you
        are ready.{' '}
        <a
          href="https://www.decleanup.net/public/guides/celo"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-green hover:underline"
        >
          How it works
        </a>
        .
      </p>
    </section>
  )
}
