'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

type Props = {
  /** Settings page: expanded by default */
  defaultOpen?: boolean
  compact?: boolean
  ctaLabel?: string
}

/** Create wallet passkey while account is in pending-password phase */
export function WalletPasskeySetupForm({
  defaultOpen = false,
  compact = false,
  ctaLabel,
}: Props) {
  const { setSigningPassword } = useWallet()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(defaultOpen)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    try {
      await setSigningPassword(password)
      setPassword('')
      setConfirm('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save password')
    } finally {
      setPending(false)
    }
  }

  if (!open && !defaultOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/10 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        {ctaLabel ?? `Set ${WALLET_PASSKEY_LOWER} now`}
      </Button>
    )
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={compact ? 'space-y-3' : 'space-y-3 border-t border-gray-800 pt-4'}
    >
      {!compact && (
        <p className="text-sm text-gray-400">
          Optional before your first onchain action.{' '}
          <strong className="text-gray-400">Not your Google password.</strong>
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-gray-500">{WALLET_PASSKEY}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Create ${WALLET_PASSKEY_LOWER}…`}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-gray-500">Confirm</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm…"
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
        />
      </label>
      <Button
        type="submit"
        disabled={pending}
        className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
      >
        {pending ? 'Saving…' : `Save ${WALLET_PASSKEY_LOWER}`}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}
