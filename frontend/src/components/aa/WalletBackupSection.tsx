'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { ImportBackupForm } from '@/components/aa/ImportBackupForm'
import { MetamaskExportSection } from '@/components/aa/MetamaskExportSection'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

/**
 * Optional backup / restore — collapsed by default. Same Google or email sign-in
 * already syncs the smart account; backup is for extra device recovery.
 */
export function WalletBackupSection() {
  const [open, setOpen] = useState(false)
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
          <h2 className="text-base font-semibold text-white">Back up</h2>
          <p className="mt-1 text-sm text-gray-400">
            Additional steps to load your account on other devices
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
              Download a backup file to always get access to the same smart account address on any
              device you use.
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
            <h3 className="text-sm font-semibold text-white">Restore smart account</h3>
            <p className="text-sm text-gray-400">
              Recover on a new device or browser. Sign in with Google or email first, then upload
              your encrypted backup.
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
