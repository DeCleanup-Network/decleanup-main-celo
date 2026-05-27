'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

export function UnlockWallet() {
  const { unlock, unlockWithPasskey, isPasskeyEnabled, passkeyLoading, error } = useWallet()
  const [password, setPassword] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)

  useEffect(() => {
    if (isPasskeySupported()) {
      void isPlatformAuthenticatorAvailable().then(setPasskeyAvailable)
    }
  }, [])

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setPending(true)
    try {
      await unlock(password, duration)
      setPassword('')
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
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Biometric unlock failed')
    } finally {
      setPending(false)
    }
  }

  const showPasskey = isPasskeyEnabled && isPasskeySupported()

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Unlock wallet</h2>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Enter <strong className="text-gray-400">{WALLET_PASSKEY_POSSESSIVE}</strong> (not your Google login).
        After unlock, you can sign DeCleanup Rewards submissions for a while without re-typing it.
      </p>

      <SigningSessionDurationField duration={duration} onDurationChange={setDuration} />

      {showPasskey && (
        <Button
          type="button"
          disabled={pending || passkeyLoading}
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => void submitPasskey()}
        >
          {pending || passkeyLoading ? 'Waiting for biometrics…' : 'Unlock with Face ID / Touch ID'}
        </Button>
      )}

      {showPasskey && <p className="text-center text-[10px] text-gray-600">or use {WALLET_PASSKEY_LOWER}</p>}

      <form onSubmit={submitPassword} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">{WALLET_PASSKEY}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            required={!showPasskey}
          />
        </label>

        <Button
          type="submit"
          disabled={pending}
          variant={showPasskey ? 'outline' : 'default'}
          className={
            showPasskey
              ? 'w-full border-gray-600 text-gray-200'
              : 'w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90'
          }
        >
          {pending ? 'Unlocking…' : 'Unlock wallet'}
        </Button>
      </form>

      {(localError || error) && <p className="text-xs text-red-400">{localError ?? error}</p>}

      {!showPasskey && passkeyAvailable && !isPasskeyEnabled && (
        <p className="text-[10px] text-gray-600">
          Enable Face ID / Touch ID below for faster unlock on this device.
        </p>
      )}
    </div>
  )
}
