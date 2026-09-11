'use client'

import { PasscodeUnlockPanel } from '@/components/aa/PasscodeUnlockPanel'

export function UnlockWallet() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Unlock with passcode</h2>
      <p className="text-sm text-gray-400">Enter your 6-digit account passcode.</p>
      <PasscodeUnlockPanel />
    </div>
  )
}
