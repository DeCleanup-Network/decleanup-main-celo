'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EnablePasskey } from '@/components/aa/EnablePasskey'
import { useWallet } from '@/providers/WalletProvider'
import { isPasskeySupported } from '@/lib/passkey/config-client'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

export function SetupWallet() {
  const { setupWallet, error, phase, isPasskeyEnabled } = useWallet()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showPasskeySetup, setShowPasskeySetup] = useState(false)
  const [savedPassword, setSavedPassword] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError(`Use at least 8 characters for your ${WALLET_PASSKEY_LOWER}.`)
      return
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    setPending(true)
    try {
      await setupWallet(password)
      setSavedPassword(password)
      setShowPasskeySetup(isPasskeySupported())
      setPassword('')
      setConfirm('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Wallet setup failed')
    } finally {
      setPending(false)
    }
  }

  if (phase === 'unlocked' && showPasskeySetup && !isPasskeyEnabled) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-gray-900/60 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Enable faster unlock?</h2>
        <p className="text-[11px] text-gray-400">
          Use Face ID or Touch ID next time instead of typing your {WALLET_PASSKEY_LOWER}.
        </p>
        <EnablePasskey
          requirePassword={false}
          presetPassword={savedPassword}
          onEnabled={() => {
            setSavedPassword('')
            setShowPasskeySetup(false)
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-500"
          onClick={() => {
            setSavedPassword('')
            setShowPasskeySetup(false)
          }}
        >
          Skip for now
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-brand-green/30 bg-gray-900/60 p-6 space-y-4"
    >
      <h2 className="text-sm font-semibold text-white">Create your embedded wallet</h2>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Your key is generated in this browser, encrypted with your {WALLET_PASSKEY_LOWER}, and only the
        encrypted blob is stored on our servers. We never see your raw private key.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">{WALLET_PASSKEY}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          required
        />
      </label>

      <Button
        type="submit"
        disabled={pending}
        className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
      >
        {pending ? 'Creating wallet…' : 'Create wallet'}
      </Button>

      {(localError || error) && (
        <p className="text-xs text-red-400">{localError ?? error}</p>
      )}
    </form>
  )
}
