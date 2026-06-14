'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

const CELO_MAINNET_RPC = 'https://forno.celo.org'

/** Optional: reveal EOA private key to import into MetaMask on a trusted device. */
export function MetamaskExportSection() {
  const {
    decryptForExport,
    decryptForExportInSession,
    needsSigningPassword,
    hasActiveSigningSession,
  } = useWallet()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const unlocked = hasActiveSigningSession

  const revealKey = async () => {
    setError(null)
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

  return (
    <details className="group border-t border-gray-800 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-300 marker:content-none [&::-webkit-details-marker]:hidden">
        Advanced: Import to external wallet
      </summary>
      <div className="mt-3 space-y-3 text-sm text-gray-400">
        <p>
          Only on a device you trust. In MetaMask: Settings → Import account → Private Key. This exports
          the signer key for your smart account, not the Safe address itself.
        </p>
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
          Celo RPC: {CELO_MAINNET_RPC} · Chain ID: {REQUIRED_CHAIN_ID}
        </p>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </details>
  )
}
