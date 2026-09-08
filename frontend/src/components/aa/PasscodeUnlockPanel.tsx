'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { NumericPasscodePad } from '@/components/aa/NumericPasscodePad'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import {
  clearUnlockAttempts,
  getUnlockAttemptStatus,
  recordFailedUnlockAttempt,
} from '@/lib/client-wallet/unlock-attempts'
import { hasPasskeyUnlockRecord } from '@/lib/client-wallet/passkey-unlock'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

const SUPPORT_EMAIL = 'support@decleanup.net'

type Props = {
  onSuccess?: () => void
  showSessionDuration?: boolean
  compact?: boolean
  /** When biometrics are enabled, prompt Face ID / Touch ID immediately. */
  autoPromptBiometric?: boolean
}

export function PasscodeUnlockPanel({
  onSuccess,
  showSessionDuration = true,
  compact = false,
  autoPromptBiometric = true,
}: Props) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const {
    unlock,
    unlockWithPasskey,
    registerPasskey,
    isPasskeyEnabled,
    passkeyLoading,
    refreshPasskeyStatus,
  } = useWallet()
  const [passcode, setPasscode] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [passcodePending, setPasscodePending] = useState(false)
  const [biometricPending, setBiometricPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [platformAvailable, setPlatformAvailable] = useState(false)
  const [biometricSetup, setBiometricSetup] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [passkeyReady, setPasskeyReady] = useState(false)
  const autoPromptedRef = useRef(false)

  const biometricEnabled =
    isPasskeyEnabled || (userId ? hasPasskeyUnlockRecord(userId) : false)

  const showBiometric = isPasskeySupported() && platformAvailable
  const busy = passcodePending || biometricPending || passkeyLoading

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refreshPasskeyStatus()
      if (cancelled) return
      const platform = isPasskeySupported() ? await isPlatformAuthenticatorAvailable() : false
      if (cancelled) return
      setPlatformAvailable(platform)
      setPasskeyReady(true)
    })()
    setBiometricReady(true)
    return () => {
      cancelled = true
    }
  }, [refreshPasskeyStatus])

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

  const tryEnableBiometricAndUnlock = async (password: string) => {
    setLocalError(null)
    setPasscodePending(true)
    try {
      await registerPasskey(password)
      await unlockWithPasskey(duration)
      clearUnlockAttempts()
      setPasscode('')
      setBiometricSetup(false)
      onSuccess?.()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not enable biometrics')
      setPasscode('')
    } finally {
      setPasscodePending(false)
    }
  }

  const submitPasskey = async () => {
    setLocalError(null)
    setBiometricPending(true)
    try {
      await unlockWithPasskey(duration)
      clearUnlockAttempts()
      onSuccess?.()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Biometric unlock failed')
    } finally {
      setBiometricPending(false)
    }
  }

  useEffect(() => {
    if (!autoPromptBiometric || !biometricReady || !passkeyReady) return
    if (!biometricEnabled || !platformAvailable || biometricSetup) return
    if (busy || lockoutSeconds > 0) return
    if (autoPromptedRef.current) return
    autoPromptedRef.current = true
    void submitPasskey()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot Face ID prompt
  }, [
    autoPromptBiometric,
    biometricReady,
    passkeyReady,
    biometricEnabled,
    platformAvailable,
    biometricSetup,
    lockoutSeconds,
  ])

  const locked = lockoutSeconds > 0

  const biometricSubtitle = biometricSetup
    ? 'Enter your passcode once to enable Face ID / Touch ID on this device.'
    : showBiometric && biometricEnabled
      ? 'Or use Face ID / Touch ID above'
      : undefined

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {showBiometric && (
        <Button
          type="button"
          disabled={busy || locked}
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => {
            if (biometricEnabled) {
              void submitPasskey()
              return
            }
            setBiometricSetup(true)
            setPasscode('')
            setLocalError(null)
          }}
        >
          {biometricPending || passkeyLoading
            ? 'Waiting for biometrics…'
            : biometricEnabled
              ? 'Face ID / Touch ID'
              : 'Enable Face ID / Touch ID'}
        </Button>
      )}

      {showSessionDuration && (
        <SigningSessionDurationField duration={duration} onDurationChange={setDuration} compact={compact} />
      )}

      <NumericPasscodePad
        value={passcode}
        onChange={setPasscode}
        onComplete={(v) => {
          if (passcodePending || locked) return
          if (biometricSetup && !biometricEnabled) {
            void tryEnableBiometricAndUnlock(v)
            return
          }
          void tryUnlock(v)
        }}
        title={biometricSetup ? 'Enable biometrics' : 'Enter passcode'}
        subtitle={
          biometricPending
            ? 'You can still enter your 6-digit passcode while Face ID is open.'
            : biometricSubtitle
        }
        error={localError}
        disabled={passcodePending || locked}
      />

      {biometricSetup && !biometricEnabled ? (
        <button
          type="button"
          className="mx-auto block text-xs text-gray-500 underline"
          onClick={() => {
            setBiometricSetup(false)
            setPasscode('')
            setLocalError(null)
          }}
        >
          Use passcode only
        </button>
      ) : null}

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
