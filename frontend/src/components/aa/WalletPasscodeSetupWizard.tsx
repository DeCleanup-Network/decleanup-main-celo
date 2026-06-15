'use client'

import { useState } from 'react'
import { NumericPasscodePad } from '@/components/aa/NumericPasscodePad'
import { BiometricEnablePrompt } from '@/components/aa/BiometricEnablePrompt'
import { SigningSessionDurationField } from '@/components/aa/SigningSessionDurationField'
import { useWallet } from '@/providers/WalletProvider'
import { getPreferredSessionDuration, type SessionDurationId } from '@/lib/client-wallet/signing-session'
import { isValidWalletPasscode } from '@/lib/client-wallet/passcode'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

type Step = 'create' | 'confirm' | 'biometric'

type Props = {
  onComplete?: () => void
  showSessionDuration?: boolean
}

export function WalletPasscodeSetupWizard({ onComplete, showSessionDuration = false }: Props) {
  const { setSigningPassword } = useWallet()
  const [step, setStep] = useState<Step>('create')
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savedPasscode, setSavedPasscode] = useState('')
  const [duration, setDuration] = useState<SessionDurationId>(getPreferredSessionDuration())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savePasscode = async (passcode: string) => {
    setPending(true)
    setError(null)
    try {
      await setSigningPassword(passcode, showSessionDuration ? duration : undefined)
      setSavedPasscode(passcode)
      setStep('biometric')
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${WALLET_PASSCODE_LOWER}`)
      setStep('create')
      setDraft('')
      setConfirm('')
    } finally {
      setPending(false)
    }
  }

  if (step === 'create') {
    return (
      <div className="space-y-5">
        <NumericPasscodePad
          value={draft}
          onChange={(v) => {
            setDraft(v)
            setError(null)
          }}
          onComplete={(v) => {
            if (!isValidWalletPasscode(v)) {
              setError('Use 6 digits.')
              return
            }
            setDraft(v)
            setStep('confirm')
            setConfirm('')
          }}
          title="Create wallet passcode"
          subtitle="Choose 6 digits. Not your Google password or phone lock screen."
          error={error}
          disabled={pending}
        />
        {showSessionDuration ? (
          <div className="mx-auto max-w-xs">
            <SigningSessionDurationField duration={duration} onDurationChange={setDuration} compact />
          </div>
        ) : null}
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <NumericPasscodePad
        value={confirm}
        onChange={(v) => {
          setConfirm(v)
          setError(null)
        }}
        onComplete={(v) => {
          if (v !== draft) {
            setError('Passcodes do not match. Try again.')
            setConfirm('')
            setStep('create')
            setDraft('')
            return
          }
          void savePasscode(v)
        }}
        title="Confirm passcode"
        subtitle="Enter the same 6 digits again."
        error={error}
        disabled={pending}
      />
    )
  }

  return (
    <BiometricEnablePrompt
      presetPasscode={savedPasscode}
      onEnabled={() => {
        setSavedPasscode('')
        onComplete?.()
      }}
      onSkip={() => {
        setSavedPasscode('')
        onComplete?.()
      }}
    />
  )
}
