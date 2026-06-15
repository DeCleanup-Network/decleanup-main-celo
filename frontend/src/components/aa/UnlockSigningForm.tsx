'use client'

import { PasscodeUnlockPanel } from '@/components/aa/PasscodeUnlockPanel'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

/** Compact unlock block for Account settings (not a full-page gate). */
export function UnlockSigningForm() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
      <h2 className="text-base font-semibold text-white">Unlock</h2>
      <p className="text-sm text-gray-400">
        Required before submit or claim. Use Face ID when available, or your 6-digit {WALLET_PASSCODE_LOWER}.
      </p>
      <PasscodeUnlockPanel />
    </div>
  )
}
