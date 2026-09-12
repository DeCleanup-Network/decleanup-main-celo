'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NumericPasscodePad } from '@/components/aa/NumericPasscodePad'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'
import { isValidWalletPasscode } from '@/lib/client-wallet/passcode'
import { formatWebAuthnError } from '@/lib/passkey/errors'

type Props = {
  /** Required when wallet is locked — confirms the user knows their unlock passcode. */
  requirePassword?: boolean
  /** Use immediately after wallet setup (passcode already verified). */
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
  const [passcode, setPasscode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isPasskeySupported()) {
    return (
      <p className="text-sm text-gray-400">
        Biometric unlock is not supported in this browser. Use your {WALLET_PASSCODE_LOWER} instead.
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

  const enable = async (unlockPassword: string) => {
    setError(null)
    setPending(true)
    try {
      const available = await isPlatformAuthenticatorAvailable()
      if (!available) {
        throw new Error('No platform authenticator found. Try Safari on a device with biometrics.')
      }
      if (!unlockPassword) {
        throw new Error(`Enter your ${WALLET_PASSCODE_LOWER} to enable biometrics.`)
      }
      if (!presetPassword && !isValidWalletPasscode(unlockPassword)) {
        throw new Error(`Use your 6-digit ${WALLET_PASSCODE_LOWER}.`)
      }
      await registerPasskey(unlockPassword)
      setPasscode('')
      onEnabled?.()
    } catch (err) {
      setError(formatWebAuthnError(err))
      setPasscode('')
    } finally {
      setPending(false)
    }
  }

  const needsPad = requirePassword && !presetPassword
  const canEnable = Boolean(presetPassword) || isValidWalletPasscode(passcode)

  return (
    <div className="space-y-4">
      {!hideIntro && (
        <p className="text-sm text-gray-400">
          Unlock on this device without needing your {WALLET_PASSCODE_LOWER} each time.
        </p>
      )}

      {needsPad && (
        <NumericPasscodePad
          value={passcode}
          onChange={(v) => {
            setPasscode(v)
            setError(null)
          }}
          title={`Confirm with ${WALLET_PASSCODE_LOWER}`}
          error={error}
          disabled={pending || passkeyLoading}
        />
      )}

      <Button
        type="button"
        disabled={pending || passkeyLoading || !canEnable}
        variant="outline"
        className="w-full border-white/10 text-foreground"
        onClick={() => void enable(presetPassword ?? passcode)}
      >
        {pending || passkeyLoading
          ? 'Connecting Face ID…'
          : 'Enable Face ID / Touch ID'}
      </Button>

      {!needsPad && error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
