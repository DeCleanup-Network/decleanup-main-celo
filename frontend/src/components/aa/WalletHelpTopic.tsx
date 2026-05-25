'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

type Props = {
  label: string
  children: React.ReactNode
}

/** Plain label + ? expands technical explanation (mockup jargon strategy). */
export function WalletHelpTopic({ label, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-brand-green"
          aria-expanded={open}
          aria-label={`More about ${label}`}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {open ? <div className="mt-2 text-[11px] leading-relaxed text-gray-400">{children}</div> : null}
    </div>
  )
}
