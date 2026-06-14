'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'
import { formatWebAuthnError } from '@/lib/passkey/errors'

type Props = {
  /** Required when wallet is locked — confirms the user knows their unlock password. */
  requirePassword?: boolean
  /** Use immediately after wallet setup (password already verified). */
  presetPassword?: string
  onEnabled?: () => void
  /** Hide intro paragraph when parent already shows it. */
  hideIntro?: boolean
}

export function EnablePasskey({
  requirePassword = true,
  presetPassword,
  onEnabled,
  hideIntro = false,
}: Props) {
  const { registerPasskey, isPasskeyEnabled, passkeyLoading } = useWallet()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isPasskeySupported()) {
    return (
      <p className="text-sm text-gray-400">
        Biometric unlock is not supported in this browser. Use your {WALLET_PASSKEY_LOWER} instead.
      </p>
    )
  }

  if (isPasskeyEnabled) {
    return (
      <p className="text-sm text-brand-green">
        Face ID / Touch ID unlock is enabled on this device.
      </p>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const available = await isPlatformAuthenticatorAvailable()
      if (!available) {
        throw new Error('No platform authenticator found. Try Safari/Chrome on a device with biometrics.')
      }
      const unlockPassword = presetPassword ?? password
      if (!unlockPassword) {
        throw new Error(`Enter ${WALLET_PASSKEY_POSSESSIVE} to enable biometrics.`)
      }
      await registerPasskey(unlockPassword)
      setPassword('')
      onEnabled?.()
    } catch (err) {
      setError(formatWebAuthnError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!hideIntro && (
        <p className="text-sm text-gray-400">
          Optional: unlock on this device without typing your {WALLET_PASSKEY_LOWER} each time. Your private key never
          leaves this device. You still need your {WALLET_PASSKEY_LOWER} on a new phone after Google sign-in.
        </p>
      )}

      {requirePassword && !presetPassword && (
        <label className="block space-y-1">
          <span className="text-sm text-gray-400">Confirm {WALLET_PASSKEY_LOWER}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            required
          />
        </label>
      )}

      <Button
        type="submit"
        disabled={pending || passkeyLoading}
        variant="outline"
        className="w-full border-white/10 text-foreground"
      >
        {pending ? 'Enabling biometrics…' : 'Enable Face ID / Touch ID'}
      </Button>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}
