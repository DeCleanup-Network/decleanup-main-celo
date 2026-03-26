'use client'

import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** Compact copy control for use next to RainbowKit (which already shows the address). */
export function AddressCopyIconButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [address])

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy address"
      aria-label="Copy wallet address"
      className="shrink-0 rounded-md border border-gray-600/80 p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-brand-green"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  )
}
