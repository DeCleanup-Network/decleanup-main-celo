'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { TransactionPreviewCard } from '@/components/aa/TransactionPreviewCard'
import { buildTransactionPreview } from '@/lib/client-wallet/tx-preview'

type Props = {
  defaultTo?: string
  onSent?: (userOpHash: string) => void
}

export function SendTransactionForm({ defaultTo = '', onSent }: Props) {
  const { sendTransaction, hasActiveSigningSession } = useWallet()
  const [to, setTo] = useState(defaultTo)
  const [value, setValue] = useState('0')
  const [data, setData] = useState('0x')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const preview = useMemo(() => buildTransactionPreview({ to, value, data }), [to, value, data])
  const unlocked = hasActiveSigningSession
  const canSend = unlocked && preview.valid && preview.sessionAllowed && confirmed

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlocked) {
      setError('Start a signing session first.')
      return
    }
    if (!preview.valid) {
      setError('Fix errors in the transaction preview.')
      return
    }
    if (!preview.sessionAllowed) {
      setError('This transaction is not allowed under your current session policy.')
      return
    }
    if (!confirmed) {
      setError('Review the preview and confirm before sending.')
      return
    }
    if (!preview.to) return

    setPending(true)
    setError(null)
    setLastHash(null)
    try {
      const userOpHash = await sendTransaction({
        to: preview.to,
        value: preview.valueWei,
        data: preview.data,
      })
      setLastHash(userOpHash)
      setConfirmed(false)
      onSent?.(userOpHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Send gasless transaction</h2>
      <p className="text-[11px] text-gray-500">
        Review the human-readable preview before confirming. Gas sponsored via Pimlico.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">To</span>
        <input
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setConfirmed(false)
          }}
          placeholder="0x…"
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-white"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">Value (wei)</span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setConfirmed(false)
          }}
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-white"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-gray-400">Data (hex)</span>
        <input
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            setConfirmed(false)
          }}
          className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-white"
        />
      </label>

      <TransactionPreviewCard to={to} value={value} data={data} />

      <label className="flex items-start gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={!preview.valid || !preview.sessionAllowed}
          className="mt-0.5"
        />
        <span>I reviewed this transaction and want to sign it with my active session.</span>
      </label>

      <Button
        type="submit"
        disabled={pending || !canSend}
        className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
      >
        {pending
          ? 'Submitting UserOperation…'
          : !unlocked
            ? 'Start signing session to send'
            : canSend
              ? 'Confirm & send (gasless)'
              : 'Complete preview to send'}
      </Button>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {lastHash && (
        <p className="break-all text-xs text-brand-green">
          UserOp: <span className="font-mono">{lastHash}</span>
        </p>
      )}
    </form>
  )
}
