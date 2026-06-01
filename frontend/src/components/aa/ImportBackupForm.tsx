'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'
import type { WalletBackupFile } from '@/lib/client-wallet/backup'
import { readWalletBackupFromFile } from '@/lib/client-wallet/backup'

type Props = {
  redirectTo?: string
  compact?: boolean
}

export function ImportBackupForm({ redirectTo = '/wallet', compact = false }: Props) {
  const router = useRouter()
  const { importFromBackup, verifyBackupPassword } = useWallet()
  const fileRef = useRef<HTMLInputElement>(null)

  const [backup, setBackup] = useState<WalletBackupFile | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  const onFile = async (file: File | null) => {
    setError(null)
    setBackup(null)
    setFileName(null)
    setVerified(false)
    if (!file) return

    const parsed = await readWalletBackupFromFile(file)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBackup(parsed.backup)
    setFileName(file.name)
  }

  const verifyPassword = async () => {
    if (!backup || !password) return
    setPending(true)
    setError(null)
    try {
      await verifyBackupPassword(backup, password)
      setVerified(true)
      setError(null)
    } catch {
      setVerified(false)
      setError(`Incorrect ${WALLET_PASSKEY_LOWER} for this backup.`)
    } finally {
      setPending(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!backup) {
      setError('Select a backup file first.')
      return
    }
    if (password.length < 8) {
      setError(`Enter ${WALLET_PASSKEY_POSSESSIVE} (min 8 characters).`)
      return
    }
    setPending(true)
    setError(null)
    try {
      await importFromBackup(backup, password)
      setPassword('')
      router.push(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className={
        compact ? 'space-y-4' : 'space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6'
      }
    >
      {!compact && (
        <>
          <h2 className="text-sm font-semibold text-white">Restore from encrypted backup</h2>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Upload the <code className="text-gray-400">.json</code> file you downloaded earlier. Enter the
            same {WALLET_PASSKEY_LOWER} you used when the wallet was created.
          </p>
        </>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">Backup file</span>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-gray-200"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {backup && (
        <div className="rounded-lg border border-brand-green/20 bg-black/40 p-3 text-[11px] text-gray-400 space-y-1">
          <p>
            <span className="text-gray-500">File:</span> {fileName}
          </p>
          <p className="font-mono break-all">
            <span className="text-gray-500">EOA:</span> {backup.eoaAddress}
          </p>
          <p className="font-mono break-all">
            <span className="text-gray-500">Safe:</span> {backup.smartAccountAddress}
          </p>
          {verified && <p className="text-brand-green">{WALLET_PASSKEY} verified</p>}
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">{WALLET_PASSKEY}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setVerified(false)
          }}
          autoComplete="current-password"
          placeholder="Same password used when wallet was created"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          required
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={!backup || !password || pending}
          className="border-white/10 text-foreground sm:flex-1"
          onClick={() => void verifyPassword()}
        >
          Test password
        </Button>
        <Button
          type="submit"
          disabled={!backup || pending}
          className="font-sans !text-black bg-brand-green hover:bg-brand-green/90 sm:flex-1"
        >
          {pending ? 'Restoring…' : 'Restore wallet'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
