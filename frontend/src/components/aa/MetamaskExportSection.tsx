'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'

const CELO_MAINNET_RPC = 'https://forno.celo.org'

/**
 * Optional signer-key export to MetaMask — user's own backup if they forget the app wallet passkey later.
 */
export function MetamaskExportSection() {
  const {
    decryptForExport,
    decryptForExportInSession,
    needsSigningPassword,
    hasActiveSigningSession,
  } = useWallet()
  const [open, setOpen] = useState(false)
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
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-white">Back up to MetaMask (optional)</h2>
          <p className="mt-1 text-sm text-gray-400">
            Export your signing key for MetaMask, gardens.fund, and $cDCU airdrops. Same address as Account settings.
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-gray-800 px-4 pb-4 pt-4 text-sm text-gray-400">
          <p>
            Google sign-in already syncs your wallet. Import this key in MetaMask on a device you trust (Settings →
            Import account → Private Key). Use that address on gardens.fund and for airdrop whitelist checks. It matches
            your wallet address in Account settings.
          </p>
          <p className="text-xs text-gray-500">
            Forgot the app {WALLET_PASSKEY_LOWER}? Connect the same MetaMask account from the home page instead of
            Google unlock.
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
              {unlocked ? (
                <p className="text-sm text-brand-green">Wallet unlocked. Reveal without typing your passkey again.</p>
              ) : null}
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
      ) : null}
    </div>
  )
}
