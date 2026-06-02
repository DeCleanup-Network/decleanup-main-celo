'use client'

import Link from 'next/link'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/**
 * Non-custodial wallet recovery expectations — shown first on Smart account settings.
 */
export function WalletRecoveryInfoCard() {
  return (
    <section className="rounded-xl border border-gray-700/80 bg-gray-900/40 p-4 space-y-3 text-sm text-gray-300">
      <h2 className="font-bebas text-xl tracking-wide text-white">HOW YOUR WALLET IS PROTECTED</h2>
      <p>
        Google or email sign-in only opens the app. It does not store or recover your onchain wallet.
      </p>
      <p>
        Your {WALLET_PASSKEY_LOWER} encrypts your wallet key in this browser. DeCleanup Rewards is
        non-custodial — our team cannot see, reset, or recover your {WALLET_PASSKEY_LOWER} or private key.
      </p>
      <p>
        Use your encrypted backup file in the section below (same smart account address). Without that
        backup, we cannot restore access — you would need to create a new wallet and lose control of the
        old onchain address from this login.
      </p>
      <p className="text-gray-400">
        Optional: download a backup anytime while you still know your {WALLET_PASSKEY_LOWER}.{' '}
        <Link href="/import-wallet" className="text-brand-green hover:underline">
          Import backup file
        </Link>
      </p>
    </section>
  )
}
