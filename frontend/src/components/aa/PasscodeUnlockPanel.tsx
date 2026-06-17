'use client'

import { useEffect, useState } from 'react'
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
import { WALLET_PASSCODE, WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

type Props = {
  onSuccess?: () => void
  showSessionDuration?: boolean
  compact?: boolean
}

export function PasscodeUnlockPanel({ onSuccess, showSessionDuration = true, compact = false }: Props) {
  const { unlock, unlockWithPasskey, registerPasskey, isPasskeyEnabled, passkeyLoading, error } = useWallet()
  const [passcode, setPasscode] = useState('')
  const [legacyMode, setLegacyMode] = useState(false)
  const [legacyPassword, setLegacyPassword] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [platformAvailable, setPlatformAvailable] = useState(false)
  const [biometricSetup, setBiometricSetup] = useState(false)

  const showBiometric = isPasskeySupported() && platformAvailable

  useEffect(() => {
    if (!isPasskeySupported()) return
    void isPlatformAuthenticatorAvailable().then(setPlatformAvailable)
  }, [])

  useEffect(() => {
    const status = getUnlockAttemptStatus()
    setLockoutSeconds(status.lockoutSeconds)
    if (!status.locked) return
    const timer = window.setInterval(() => {
      const next = getUnlockAttemptStatus()
      setLockoutSeconds(next.lockoutSeconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [localError, pending])

  const tryUnlock = async (password: string) => {
    const status = getUnlockAttemptStatus()
    if (status.locked) {
      setLocalError(`Too many attempts. Wait ${status.lockoutSeconds}s.`)
      return
    }
    setLocalError(null)
    setPending(true)
    try {
      await unlock(password, duration)
      clearUnlockAttempts()
      setPasscode('')
      setLegacyPassword('')
      onSuccess?.()
    } catch {
      const next = recordFailedUnlockAttempt()
      setPasscode('')
      setLegacyPassword('')
      if (next.locked) {
        setLocalError(`Too many attempts. Wait ${next.lockoutSeconds}s.`)
        setLockoutSeconds(next.lockoutSeconds)
      } else {
        setLocalError(`Incorrect ${WALLET_PASSCODE_LOWER}. ${next.remaining} attempt(s) left.`)
      }
    } finally {
      setPending(false)
    }
  }

  const tryEnableBiometricAndUnlock = async (password: string) => {
    setLocalError(null)
    setPending(true)
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
      setPending(false)
    }
  }

  const submitPasskey = async () => {
    setLocalError(null)
    setPending(true)
    try {
      await unlockWithPasskey(duration)
      clearUnlockAttempts()
      onSuccess?.()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Biometric unlock failed')
    } finally {
      setPending(false)
    }
  }

  const locked = lockoutSeconds > 0

  const biometricSubtitle = biometricSetup
    ? 'Enter your passcode once to enable Face ID / Touch ID on this device.'
    : showBiometric
      ? 'Or use Face ID / Touch ID above'
      : undefined

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {showBiometric && !legacyMode && (
        <Button
          type="button"
          disabled={pending || passkeyLoading || locked}
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => {
            if (isPasskeyEnabled) {
              void submitPasskey()
              return
            }
            setBiometricSetup(true)
            setPasscode('')
            setLocalError(null)
          }}
        >
          {pending || passkeyLoading
            ? 'Waiting for biometrics…'
            : isPasskeyEnabled
              ? 'Face ID / Touch ID'
              : 'Enable Face ID / Touch ID'}
        </Button>
      )}

      {showSessionDuration && (
        <SigningSessionDurationField duration={duration} onDurationChange={setDuration} compact={compact} />
      )}

      {legacyMode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void tryUnlock(legacyPassword)
          }}
          className="space-y-3"
        >
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">{WALLET_PASSCODE}</span>
            <input
              type="password"
              value={legacyPassword}
              onChange={(e) => setLegacyPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              disabled={locked || pending}
            />
          </label>
          <Button type="submit" disabled={pending || locked || !legacyPassword} className="w-full">
            {pending ? 'Unlocking…' : 'Unlock'}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-gray-500 underline"
            onClick={() => {
              setLegacyMode(false)
              setLegacyPassword('')
              setLocalError(null)
            }}
          >
            Use 6-digit passcode
          </button>
        </form>
      ) : (
        <>
          <NumericPasscodePad
            value={passcode}
            onChange={setPasscode}
            onComplete={(v) => {
              if (biometricSetup && !isPasskeyEnabled) {
                void tryEnableBiometricAndUnlock(v)
                return
              }
              void tryUnlock(v)
            }}
            title={biometricSetup ? 'Enable biometrics' : 'Enter passcode'}
            subtitle={biometricSubtitle}
            error={localError}
            disabled={pending || locked}
          />
          {biometricSetup && !isPasskeyEnabled ? (
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
          ) : (
            <button
              type="button"
              className="mx-auto block text-xs text-gray-500 underline"
              onClick={() => {
                setLegacyMode(true)
                setPasscode('')
                setBiometricSetup(false)
                setLocalError(null)
              }}
            >
              Using longer passcode?
            </button>
          )}
        </>
      )}

      {(error && !localError) || (legacyMode && localError) ? (
        <p className="text-center text-sm text-red-400">{localError ?? error}</p>
      ) : null}
    </div>
  )
}
