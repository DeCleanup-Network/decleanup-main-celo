'use client'

import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyableAddressProps = {
  address: string
  /** When false, shows full address (wraps); when true, shows 0x1234…abcd */
  truncate?: boolean
  className?: string
}

export function CopyableAddress({ address, truncate = true, className = '' }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false)

  const display = truncate ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

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
      aria-label={`Copy address ${display}`}
      className={`inline-flex max-w-full min-w-0 gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-left transition hover:border-border hover:bg-muted/50 ${truncate ? 'items-center' : 'items-start'} ${className}`}
    >
      <span className={`font-mono tabular-nums ${truncate ? '' : 'break-all text-left'}`}>{display}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </button>
  )
}
