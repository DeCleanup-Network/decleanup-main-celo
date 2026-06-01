'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { EnablePasskey } from '@/components/aa/EnablePasskey'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

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
  const {
    unlock,
    unlockWithPasskey,
    setSigningPassword,
    isPasskeyEnabled,
    passkeyLoading,
    error,
  } = useWallet()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const [offerPasskey, setOfferPasskey] = useState(false)
  const [savedPassword, setSavedPassword] = useState('')

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirm('')
    setLocalError(null)
    setOfferPasskey(false)
    setSavedPassword('')
    if (isPasskeySupported()) {
      void isPlatformAuthenticatorAvailable().then(setPasskeyAvailable)
    }
  }, [open])

  if (!open) return null

  const showPasskeyUnlock = mode === 'unlock' && isPasskeyEnabled && isPasskeySupported()

  const submitSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Entries do not match.')
      return
    }
    setPending(true)
    try {
      await setSigningPassword(password, duration)
      setSavedPassword(password)
      if (passkeyAvailable && isPasskeySupported()) {
        setOfferPasskey(true)
        return
      }
      onSuccess()
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : `Could not save ${WALLET_PASSKEY_LOWER}`)
    } finally {
      setPending(false)
    }
  }

  const submitUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setPending(true)
    try {
      await unlock(password, duration)
      setPassword('')
      onSuccess()
      onClose()
    } catch {
      setLocalError(`Incorrect ${WALLET_PASSKEY_POSSESSIVE}.`)
    } finally {
      setPending(false)
    }
  }

  const submitPasskey = async () => {
    setLocalError(null)
    setPending(true)
    try {
      await unlockWithPasskey(duration)
      onSuccess()
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Biometric unlock failed')
    } finally {
      setPending(false)
    }
  }

  if (offerPasskey && savedPassword) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
        <div
          className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
        >
          <h2 className="text-lg font-semibold text-white">Use Face ID next time?</h2>
          <p className="mt-2 text-sm text-gray-400">
            Unlock with biometrics on this device so you don&apos;t have to type your {WALLET_PASSKEY_LOWER} every time.
          </p>
          <div className="mt-4 space-y-3">
            <EnablePasskey
              requirePassword={false}
              presetPassword={savedPassword}
              onEnabled={() => {
                setSavedPassword('')
                setOfferPasskey(false)
                onSuccess()
                onClose()
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-gray-500"
              onClick={() => {
                setSavedPassword('')
                setOfferPasskey(false)
                onSuccess()
                onClose()
              }}
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-unlock-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="sign-unlock-title" className="text-lg font-semibold text-white">
            {mode === 'set-password' ? `Set your ${WALLET_PASSKEY_LOWER}` : 'Unlock to sign'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-400">
          {mode === 'set-password' ? (
            <>
              To {purpose}, choose a {WALLET_PASSKEY_LOWER} that stays on this device.{' '}
              <strong className="text-gray-300">This is not your Google password.</strong>
            </>
          ) : (
            <>To {purpose}, enter {WALLET_PASSKEY_POSSESSIVE}.</>
          )}
        </p>

        <div className="mt-3">
          <SigningSessionDurationField
            duration={duration}
            onDurationChange={setDuration}
            compact
          />
        </div>

        {mode === 'unlock' && showPasskeyUnlock && (
          <Button
            type="button"
            disabled={pending || passkeyLoading}
            className="mt-4 w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
            onClick={() => void submitPasskey()}
          >
            {pending || passkeyLoading ? 'Waiting for biometrics…' : 'Use Face ID / Touch ID'}
          </Button>
        )}

        <form
          onSubmit={mode === 'set-password' ? submitSetPassword : submitUnlock}
          className={`space-y-3 ${mode === 'unlock' && showPasskeyUnlock ? 'mt-3' : 'mt-4'}`}
        >
          {mode === 'set-password' && (
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Confirm {WALLET_PASSKEY_LOWER}</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">
              {mode === 'set-password' ? `Create ${WALLET_PASSKEY_LOWER}` : WALLET_PASSKEY}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'set-password' ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              required
            />
          </label>

          <Button
            type="submit"
            disabled={pending}
            variant={mode === 'unlock' && showPasskeyUnlock ? 'outline' : 'default'}
            className={
              mode === 'unlock' && showPasskeyUnlock
                ? 'w-full border-white/10 text-foreground'
                : 'w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90'
            }
          >
            {pending
              ? 'Please wait…'
              : mode === 'set-password'
                ? 'Confirm and continue'
                : 'Unlock'}
          </Button>
        </form>

        {(localError || error) && <p className="mt-2 text-xs text-red-400">{localError ?? error}</p>}
      </div>
    </div>
  )
}
