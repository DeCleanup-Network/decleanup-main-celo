'use client'

import { useEffect, useState } from 'react'
import { NumericPasscodePad } from '@/components/aa/NumericPasscodePad'
import { useWallet } from '@/providers/WalletProvider'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import {
  clearUnlockAttempts,
  getUnlockAttemptStatus,
  recordFailedUnlockAttempt,
} from '@/lib/client-wallet/unlock-attempts'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

const SUPPORT_EMAIL = 'support@decleanup.net'

type Props = {
  onSuccess?: () => void
  showSessionDuration?: boolean
  compact?: boolean
}

/** Passcode-only unlock. Face ID / Touch ID lives in Account settings → PasskeySettings. */
export function PasscodeUnlockPanel({
  onSuccess,
  showSessionDuration = true,
  compact = false,
}: Props) {
  const { unlock } = useWallet()
  const [passcode, setPasscode] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [passcodePending, setPasscodePending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)

  useEffect(() => {
    const status = getUnlockAttemptStatus()
    setLockoutSeconds(status.lockoutSeconds)
    if (!status.locked) return
    const timer = window.setInterval(() => {
      const next = getUnlockAttemptStatus()
      setLockoutSeconds(next.lockoutSeconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [localError, passcodePending])

  const tryUnlock = async (password: string) => {
    const status = getUnlockAttemptStatus()
    if (status.locked) {
      setLocalError(`Too many attempts. Wait ${status.lockoutSeconds}s.`)
      return
    }
    setLocalError(null)
    setPasscodePending(true)
    try {
      await unlock(password, duration)
      clearUnlockAttempts()
      setPasscode('')
      onSuccess?.()
    } catch {
      const next = recordFailedUnlockAttempt()
      setPasscode('')
      if (next.locked) {
        setLocalError(`Too many attempts. Wait ${next.lockoutSeconds}s.`)
        setLockoutSeconds(next.lockoutSeconds)
      } else {
        setLocalError(
          `Incorrect ${WALLET_PASSCODE_LOWER}. ${next.remaining} attempt(s) left. If this keeps failing after clearing site data or switching devices, email ${SUPPORT_EMAIL}.`
        )
      }
    } finally {
      setPasscodePending(false)
    }
  }

  const locked = lockoutSeconds > 0

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {showSessionDuration && (
        <SigningSessionDurationField duration={duration} onDurationChange={setDuration} compact={compact} />
      )}

      <NumericPasscodePad
        value={passcode}
        onChange={setPasscode}
        onComplete={(v) => {
          if (passcodePending || locked) return
          void tryUnlock(v)
        }}
        title="Enter passcode"
        error={localError}
        disabled={passcodePending || locked}
      />

      <p className="text-center text-[11px] leading-relaxed text-gray-500">
        Forgot your account passcode? Contact{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-green hover:underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        to reset the account address for your email address. This will create a new profile with no past activity
        tracked.
      </p>
    </div>
  )
}
