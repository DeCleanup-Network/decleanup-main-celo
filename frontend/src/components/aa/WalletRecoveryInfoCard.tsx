'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, BIOMETRIC_FACE_ID } from '@/lib/client-wallet/copy'

/**
 * Non-custodial wallet recovery expectations — shown in Smart account settings.
 */
export function WalletRecoveryInfoCard() {
  return (
    <section className="rounded-xl border border-gray-700/80 bg-gray-900/40 p-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden />
        <div className="space-y-3 text-sm text-gray-300">
          <h2 className="text-base font-semibold text-white">How your wallet is protected</h2>
          <p>
            <strong className="text-gray-200">Google or email sign-in</strong> only opens the app. It does{' '}
            <strong className="text-gray-200">not</strong> store or recover your onchain wallet.
          </p>
          <p>
            Your <strong className="text-gray-200">{WALLET_PASSKEY_LOWER}</strong> encrypts your wallet key in
            this browser. DeCleanup is <strong className="text-gray-200">non-custodial</strong> — our team cannot
            see, reset, or recover your {WALLET_PASSKEY_LOWER} or private key.
          </p>
          <p>
            Day to day, use <strong className="text-gray-200">{BIOMETRIC_FACE_ID}</strong> after you enable it
            below. You only need to type your {WALLET_PASSKEY_LOWER} if biometrics fail or you use a new device.
          </p>
          <div className="rounded-lg border border-amber-700/35 bg-amber-950/25 px-3 py-2.5 text-xs text-amber-100/95">
            <p className="font-medium text-amber-200">If you forget your {WALLET_PASSKEY_LOWER}</p>
            <p className="mt-1 leading-relaxed">
              Use your <strong>encrypted backup file</strong> in the section below (same smart account address).
              Without that backup, we cannot restore access — you would need to create a new wallet and lose
              control of the old onchain address from this login.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Optional: download a backup anytime while you still know your {WALLET_PASSKEY_LOWER}.{' '}
            <Link href="/import-wallet" className="text-brand-green hover:underline">
              Import backup file
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
