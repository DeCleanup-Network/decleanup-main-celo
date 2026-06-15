'use client'

import { useState } from 'react'
import { ScanFace } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported, isPlatformAuthenticatorAvailable } from '@/lib/passkey/config-client'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'
import { formatWebAuthnError } from '@/lib/passkey/errors'

type Props = {
  presetPasscode: string
  onEnabled?: () => void
  onSkip?: () => void
  /** Inline card vs compact copy for modals */
  variant?: 'card' | 'compact'
}

export function BiometricEnablePrompt({
  presetPasscode,
  onEnabled,
  onSkip,
  variant = 'card',
}: Props) {
  const { registerPasskey, passkeyLoading } = useWallet()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isPasskeySupported()) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-gray-400">
          Biometrics are not available in this browser. You can unlock with your {WALLET_PASSCODE_LOWER} on
          any device after Google sign-in.
        </p>
        <Button type="button" className="w-full bg-brand-green font-sans !text-black" onClick={onSkip}>
          Continue
        </Button>
      </div>
    )
  }

  const enable = async () => {
    setError(null)
    setPending(true)
    try {
      const available = await isPlatformAuthenticatorAvailable()
      if (!available) {
        throw new Error('No Face ID, Touch ID, or Windows Hello found on this device.')
      }
      await registerPasskey(presetPasscode)
      onEnabled?.()
    } catch (err) {
      setError(formatWebAuthnError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={variant === 'card' ? 'space-y-5 text-center' : 'space-y-3'}>
      <div className="flex justify-center">
        <div className="rounded-full border border-brand-green/30 bg-brand-green/10 p-4">
          <ScanFace className="h-10 w-10 text-brand-green" aria-hidden />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Use Face ID next time?</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          Unlock faster on this device without entering your {WALLET_PASSCODE_LOWER} every time you submit or
          claim. You can turn this off later in Account settings.
        </p>
      </div>
      <div className="space-y-2">
        <Button
          type="button"
          disabled={pending || passkeyLoading}
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => void enable()}
        >
          {pending || passkeyLoading ? 'Waiting for biometrics…' : 'Enable Face ID / Touch ID'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-gray-500"
          onClick={onSkip}
        >
          Not now
        </Button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
