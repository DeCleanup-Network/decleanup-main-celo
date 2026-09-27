'use client'

import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyableAddressProps = {
  address: string
  /** When false, shows full address (wraps); when true, shows 0x1234…abcd */
  truncate?: boolean
  className?: string
  /** If set, the address text opens this URL; the copy icon still copies. */
  href?: string
}

export function CopyableAddress({
  address,
  truncate = true,
  className = '',
  href,
}: CopyableAddressProps) {
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

  const copyButton = (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy address"
      aria-label={`Copy address ${display}`}
      className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  )

  const addressClass = `font-mono tabular-nums ${truncate ? '' : 'break-all text-left'}`

  if (href) {
    return (
      <span
        className={`inline-flex max-w-full min-w-0 gap-1.5 px-1 py-0.5 ${truncate ? 'items-center' : 'items-start'} ${className}`}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`View ${display} on explorer`}
          className={`${addressClass} text-brand-green hover:underline`}
        >
          {display}
        </a>
        {copyButton}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy address"
      aria-label={`Copy address ${display}`}
      className={`inline-flex max-w-full min-w-0 gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-left transition hover:border-border hover:bg-muted/50 ${truncate ? 'items-center' : 'items-start'} ${className}`}
    >
      <span className={addressClass}>{display}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </button>
  )
}
