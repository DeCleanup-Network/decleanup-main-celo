'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumericPasscodePad } from '@/components/aa/NumericPasscodePad'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'
import { isValidWalletPasscode } from '@/lib/client-wallet/passcode'

/**
 * Optional signer-key export to an external crypto wallet.
 */
export function MetamaskExportSection() {
  const {
    decryptForExport,
    decryptForExportInSession,
    needsSigningPassword,
    hasActiveSigningSession,
  } = useWallet()
  const [open, setOpen] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const unlocked = hasActiveSigningSession

  const revealKey = async (password?: string) => {
    setError(null)
    setRevealedKey(null)
    if (needsSigningPassword) {
      setError(`Set your ${WALLET_PASSCODE_LOWER} first.`)
      return
    }
    const unlockPassword = password ?? passcode
    if (!unlocked && !isValidWalletPasscode(unlockPassword)) {
      setError(`Enter your 6-digit ${WALLET_PASSCODE_LOWER}.`)
      return
    }
    setPending(true)
    try {
      const key = unlocked ? decryptForExportInSession() : await decryptForExport(unlockPassword)
      setRevealedKey(key)
      setShowKey(false)
      setPasscode('')
    } catch {
      setError(`Incorrect ${WALLET_PASSCODE_LOWER}.`)
      setPasscode('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-white">Back up to external wallet</h2>
          <p className="mt-1 text-sm text-gray-400">Export your signing key to your crypto wallet</p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-gray-800 px-4 pb-4 pt-4">
          {!revealedKey ? (
            <>
              {!unlocked && (
                <NumericPasscodePad
                  value={passcode}
                  onChange={(v) => {
                    setPasscode(v)
                    setError(null)
                  }}
                  onComplete={(v) => void revealKey(v)}
                  title={`Confirm ${WALLET_PASSCODE_LOWER}`}
                  error={error}
                  disabled={pending}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || (!unlocked && !isValidWalletPasscode(passcode))}
                className="w-full border-white/10 text-foreground"
                onClick={() => void revealKey()}
              >
                {pending ? 'Revealing…' : 'Reveal private key'}
              </Button>
              {unlocked && error ? <p className="text-xs text-red-400">{error}</p> : null}
            </>
          ) : (
            <div className="relative">
              <p
                className={`break-all rounded-lg border border-gray-700 bg-black p-3 font-mono text-xs text-gray-200 ${
                  showKey ? '' : 'blur-sm select-none'
                }`}
              >
                {revealedKey}
              </p>
              <button
                type="button"
                className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-white/[0.06]"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
