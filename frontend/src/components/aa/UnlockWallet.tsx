'use client'

import { PasscodeUnlockPanel } from '@/components/aa/PasscodeUnlockPanel'
import { WALLET_PASSCODE_POSSESSIVE } from '@/lib/client-wallet/copy'

export function UnlockWallet() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Unlock wallet</h2>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Enter <strong className="text-gray-400">{WALLET_PASSCODE_POSSESSIVE}</strong> (not your Google login).
        After unlock, you can sign DeCleanup Rewards submissions for a while without re-entering it.
      </p>
      <PasscodeUnlockPanel />
    </div>
  )
}
