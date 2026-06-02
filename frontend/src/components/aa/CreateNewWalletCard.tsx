'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

type Props = {
  visible: boolean
}

/**
 * Last-resort recovery: new keys and new onchain address. Not a password reset.
 */
export function CreateNewWalletCard({ visible }: Props) {
  const { resetWalletAccess } = useWallet()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!visible) return null

  const onCreateNew = async () => {
    const confirmed = window.confirm(
      'Create a new wallet?\n\n' +
        '• You will get a NEW onchain address.\n' +
        '• Cleanups, levels, and DCU on your OLD address stay on the old wallet.\n' +
        '• This cannot be undone without your backup file + old ' +
        WALLET_PASSKEY_LOWER +
        '.\n\n' +
        'Only continue if you have no backup and accept losing the old wallet.'
    )
    if (!confirmed) return

    const typed = window.prompt('Type CREATE NEW WALLET to confirm:')
    if (typed?.trim().toUpperCase() !== 'CREATE NEW WALLET') return

    setPending(true)
    setError(null)
    setDone(false)
    try {
      await resetWalletAccess()
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create new wallet')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-red-200">Last resort: create new wallet</h3>
          <p className="text-xs leading-relaxed text-red-100/90">
            This is <strong>not</strong> a {WALLET_PASSKEY_LOWER} reset. It removes the wallet linked to this
            login and generates a <strong>new address</strong>. Try{' '}
            <Link href="/import-wallet" className="text-brand-green underline">
              importing your backup
            </Link>{' '}
            first if you still have the file.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-800/60 text-red-200 hover:bg-red-950/40"
            onClick={() => void onCreateNew()}
            disabled={pending}
          >
            {pending ? 'Creating new wallet…' : 'Create new wallet (new address)'}
          </Button>
          {done ? (
            <p className="text-xs text-brand-green">
              New wallet setup started. Finish setup above when prompted.
            </p>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
