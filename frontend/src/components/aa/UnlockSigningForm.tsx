'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported } from '@/lib/passkey/config-client'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

/** Compact unlock block for Account settings (not a full-page gate). */
export function UnlockSigningForm() {
  const { unlock, unlockWithPasskey, isPasskeyEnabled, passkeyLoading, error } = useWallet()
  const [password, setPassword] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const showPasskey = isPasskeyEnabled && isPasskeySupported()

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setPending(true)
    try {
      await unlock(password, duration)
      setPassword('')
    } catch {
      setLocalError(`Incorrect ${WALLET_PASSKEY_LOWER}.`)
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

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-3">
      <h2 className="text-base font-semibold text-white">Unlock</h2>
      <p className="text-sm text-gray-400">
        Required before submit or claim. Prefer Face ID; use your {WALLET_PASSKEY_LOWER} if biometrics fail.
      </p>

      {showPasskey && (
        <Button
          type="button"
          disabled={pending || passkeyLoading}
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => void submitPasskey()}
        >
          {pending || passkeyLoading ? 'Waiting for biometrics…' : 'Face ID / Touch ID'}
        </Button>
      )}

      <form onSubmit={submitPassword} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`${WALLET_PASSKEY}…`}
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          required={!showPasskey}
        />
        <Button
          type="submit"
          disabled={pending}
          variant={showPasskey ? 'outline' : 'default'}
          className={
            showPasskey
              ? 'w-full border-white/10 text-foreground'
              : 'w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90'
          }
        >
          {pending ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>

      <SigningSessionDurationField duration={duration} onDurationChange={setDuration} />

      {(localError || error) && <p className="text-sm text-red-400">{localError ?? error}</p>}

    </div>
  )
}
