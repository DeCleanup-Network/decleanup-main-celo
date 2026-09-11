'use client'

import { Button } from '@/components/ui/button'
import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'
import { PasscodeUnlockPanel } from '@/components/aa/PasscodeUnlockPanel'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

export type SignUnlockModalMode = 'unlock' | 'set-password'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  mode: SignUnlockModalMode
  /** e.g. "submit this cleanup" or "claim your Impact Product level" */
  purpose: string
}

export function SignUnlockModal({ open, onClose, onSuccess, mode, purpose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={mode === 'unlock' ? 'sign-unlock-title' : undefined}
        aria-label={mode === 'set-password' ? 'Create your account passcode' : undefined}
      >
        <div className="mb-4 flex items-start justify-end">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {mode === 'set-password' ? (
          <WalletPasscodeSetupWizard
            showSessionDuration
            onComplete={() => {
              onSuccess()
              onClose()
            }}
          />
        ) : (
          <>
            <h2 id="sign-unlock-title" className="mb-2 text-lg font-semibold text-white">
              Unlock
            </h2>
            <p className="mb-4 text-center text-sm text-gray-400">
              Enter your 6-digit account passcode.
            </p>
            <PasscodeUnlockPanel
              compact
              showSessionDuration
              onSuccess={() => {
                onSuccess()
                onClose()
              }}
            />
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-4 w-full text-gray-500"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
