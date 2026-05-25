'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Hex } from 'viem'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { Button } from '@/components/ui/button'
import { ImportBackupForm } from '@/components/aa/ImportBackupForm'
import { useWallet } from '@/providers/WalletProvider'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { WALLET_PASSKEY } from '@/lib/client-wallet/copy'

type Tab = 'backup' | 'private-key'

function normalizePrivateKey(input: string): Hex | null {
  const trimmed = input.trim()
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (/^0x[0-9a-fA-F]{64}$/.test(hex)) return hex as Hex
  return null
}

export default function ImportWalletPage() {
  const router = useRouter()
  const { status } = useSession()
  const aaEnabled = isAaAuthEnabledClient()
  const { importWallet } = useWallet()
  const [tab, setTab] = useState<Tab>('backup')

  const [privateKeyInput, setPrivateKeyInput] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (aaEnabled && status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/import-wallet')
    }
  }, [aaEnabled, status, router])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-400">
        AA auth is not enabled.
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-400">
        Redirecting to sign in…
      </div>
    )
  }

  const submitPrivateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const key = normalizePrivateKey(privateKeyInput)
    if (!key) {
      setError('Enter a valid 32-byte hex private key (0x…).')
      return
    }
    if (password.length < 8) {
      setError(`${WALLET_PASSKEY} must be at least 8 characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    try {
      await importWallet(key, password)
      router.replace('/wallet')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div>
        <BackToDeCleanupLink />
        <h1 className="mt-2 font-bebas text-2xl tracking-wider text-white sm:text-3xl">Restore wallet</h1>
        <p className="mt-2 text-sm text-gray-400">
          Recover on a new device or browser. Sign in with Google first, then restore using your encrypted
          backup or private key.
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-gray-800 p-1">
        <button
          type="button"
          onClick={() => setTab('backup')}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'backup' ? 'bg-brand-green text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          Encrypted backup
        </button>
        <button
          type="button"
          onClick={() => setTab('private-key')}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'private-key' ? 'bg-brand-green text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          Private key
        </button>
      </div>

      {tab === 'backup' ? (
        <ImportBackupForm redirectTo="/wallet" />
      ) : (
        <form
          onSubmit={submitPrivateKey}
          className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6"
        >
          <h2 className="text-sm font-semibold text-white">Import from private key</h2>
          <p className="text-[11px] text-gray-500">
            Advanced recovery. Your key is re-encrypted locally and synced. Existing Safe address is
            preserved when the EOA matches.
          </p>

          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Private key</span>
            <textarea
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              rows={3}
              placeholder="0x…"
              className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-white"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-gray-400">New {WALLET_PASSKEY}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              required
            />
          </label>

          <Button
            type="submit"
            disabled={pending}
            className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          >
            {pending ? 'Importing…' : 'Import & encrypt'}
          </Button>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      )}
    </div>
  )
}
