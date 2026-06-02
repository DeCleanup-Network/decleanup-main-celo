'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { ImportBackupForm } from '@/components/aa/ImportBackupForm'
import { MetamaskExportSection } from '@/components/aa/MetamaskExportSection'
import { useSession } from 'next-auth/react'
import { useWallet } from '@/providers/WalletProvider'
import { markWalletBackupDownloaded } from '@/lib/client-wallet/account-setup'
import {
  WALLET_PASSKEY,
  WALLET_PASSKEY_LOWER,
  WALLET_PASSKEY_POSSESSIVE,
} from '@/lib/client-wallet/copy'

/**
 * Backup download + restore — the real "forgot wallet passkey" path (same onchain address).
 */
export function WalletBackupSection({ onBackupDownloaded }: { onBackupDownloaded?: () => void }) {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()
  const userId = session?.user?.id
  const {
    downloadEncryptedBackup,
    downloadEncryptedBackupInSession,
    smartAccountAddress,
    needsSigningPassword,
    hasActiveSigningSession,
  } = useWallet()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const unlocked = hasActiveSigningSession

  const downloadBackup = async () => {
    setError(null)
    setSuccess(null)
    if (needsSigningPassword) {
      setError(`Set ${WALLET_PASSKEY_POSSESSIVE} first.`)
      return
    }
    setPending(true)
    try {
      if (unlocked) {
        await downloadEncryptedBackupInSession()
      } else {
        if (!password) {
          setError(`Unlock above or enter ${WALLET_PASSKEY_POSSESSIVE}.`)
          return
        }
        await downloadEncryptedBackup(password)
      }
      setSuccess('Backup saved. Keep the file with your passkey.')
      if (userId) {
        markWalletBackupDownloaded(userId)
        onBackupDownloaded?.()
      }
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed')
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
          <h2 className="text-base font-semibold text-white">Backup &amp; restore</h2>
          <p className="mt-1 text-sm text-gray-400">
            Forgot your {WALLET_PASSKEY_LOWER}? Import your backup here - same smart account address.
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-6 border-t border-gray-800 px-4 pb-4 pt-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Download an encrypted backup while you still know your {WALLET_PASSKEY_POSSESSIVE}. Store it
              safely offline. Google sign-in alone cannot restore this wallet.
            </p>
            {smartAccountAddress ? (
              <CopyableAddress address={smartAccountAddress} className="text-sm text-gray-200" />
            ) : null}
            {unlocked ? (
              <p className="text-sm text-brand-green">
                Unlocked. Download without typing your passkey again.
              </p>
            ) : (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`${WALLET_PASSKEY}…`}
                className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              />
            )}
            <Button
              type="button"
              disabled={pending || (!unlocked && !password)}
              className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
              onClick={() => void downloadBackup()}
            >
              {pending ? 'Preparing…' : 'Download backup'}
            </Button>
            {success ? <p className="text-sm text-brand-green">{success}</p> : null}
          </div>

          <div className="space-y-3 border-t border-gray-800 pt-4">
            <h3 className="text-sm font-semibold text-white">Forgot {WALLET_PASSKEY_LOWER}? Restore here</h3>
            <p className="text-sm text-gray-400">
              Sign in with Google or email, then upload your backup file and enter the{' '}
              {WALLET_PASSKEY_LOWER} from when you created the backup. This keeps your same onchain address.
            </p>
            <ImportBackupForm redirectTo="/wallet" compact />
          </div>

          <MetamaskExportSection />

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
