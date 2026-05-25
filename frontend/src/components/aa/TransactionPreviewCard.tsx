'use client'

import { useMemo } from 'react'
import { buildTransactionPreview } from '@/lib/client-wallet/tx-preview'

type Props = {
  to: string
  value: string
  data: string
}

export function TransactionPreviewCard({ to, value, data }: Props) {
  const preview = useMemo(() => buildTransactionPreview({ to, value, data }), [to, value, data])

  if (!to && !value && data === '0x') return null

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 text-xs ${
        !preview.valid
          ? 'border-red-900/50 bg-red-950/20'
          : preview.sessionAllowed
            ? 'border-brand-green/25 bg-black/40'
            : 'border-amber-700/40 bg-amber-950/15'
      }`}
    >
      <p className="font-medium text-white">Transaction preview</p>
      <p className="text-gray-300">{preview.summary}</p>

      <dl className="grid grid-cols-2 gap-1 text-[11px] text-gray-500">
        <dt>Type</dt>
        <dd className="text-gray-400">{preview.kind === 'native-transfer' ? 'CELO transfer' : 'Contract call'}</dd>
        <dt>Amount</dt>
        <dd className="text-gray-400">{preview.valueFormatted} CELO</dd>
        {preview.functionSelector && (
          <>
            <dt>Selector</dt>
            <dd className="font-mono text-gray-400">{preview.functionSelector}</dd>
          </>
        )}
        <dt>Gas</dt>
        <dd className="text-brand-green">Sponsored (Pimlico)</dd>
      </dl>

      {preview.errors.map((e) => (
        <p key={e} className="text-red-400">
          {e}
        </p>
      ))}
      {preview.warnings.map((w) => (
        <p key={w} className="text-amber-300">
          {w}
        </p>
      ))}
      {preview.sessionNotes.map((n) => (
        <p key={n} className="text-gray-500">
          {n}
        </p>
      ))}

      {preview.valid && preview.sessionAllowed && (
        <p className="text-brand-green">Allowed under current signing session policy.</p>
      )}
    </div>
  )
}
