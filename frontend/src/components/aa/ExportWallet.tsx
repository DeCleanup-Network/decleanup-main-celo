'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { useWallet } from '@/providers/WalletProvider'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'
import { Eye, EyeOff } from 'lucide-react'

const CELO_MAINNET_RPC = 'https://forno.celo.org'

export function ExportWallet() {
  const {
    decryptForExport,
    decryptForExportInSession,
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
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

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

  const revealKey = async () => {
    setError(null)
    setSuccess(null)
    setRevealedKey(null)
    if (needsSigningPassword) {
      setError(`Set ${WALLET_PASSKEY_POSSESSIVE} first.`)
      return
    }
    setPending(true)
    try {
      const key = unlocked ? decryptForExportInSession() : await decryptForExport(password)
      setRevealedKey(key)
      setShowKey(false)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : `Incorrect ${WALLET_PASSKEY_LOWER}.`)
    } finally {
      setPending(false)
    }
  }

  const chainId = REQUIRED_CHAIN_ID

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Backup (optional)</h2>
        <p className="mt-1 text-sm text-gray-400">
          Your wallet already syncs when you sign in with Google or email. Download a backup only if you
          want an extra copy — locked with your wallet passkey.
        </p>
        <Link href="/import-wallet" className="mt-2 inline-block text-sm text-brand-green hover:underline">
          Import backup file on another device →
        </Link>
      </div>

      {smartAccountAddress && (
        <CopyableAddress address={smartAccountAddress} className="text-sm text-gray-200" />
      )}

      {unlocked ? (
        <p className="text-sm text-brand-green">Unlocked. Download without typing your passkey again.</p>
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

      {success && <p className="text-sm text-brand-green">{success}</p>}

      <details className="group border-t border-gray-800 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-300 marker:content-none [&::-webkit-details-marker]:hidden">
          Advanced: MetaMask export
        </summary>
        <div className="mt-3 space-y-3 text-sm text-gray-400">
          <p>Only on a device you trust. Import via Settings → Import account → Private Key.</p>
          {!revealedKey ? (
            <>
              {!unlocked && (
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
                variant="outline"
                size="sm"
                disabled={pending || (!unlocked && !password)}
                className="border-white/10 text-foreground"
                onClick={() => void revealKey()}
              >
                Reveal private key
              </Button>
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
          <p className="font-mono text-xs text-gray-500">
            Celo RPC: {CELO_MAINNET_RPC} · Chain ID: {chainId}
          </p>
        </div>
      </details>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
