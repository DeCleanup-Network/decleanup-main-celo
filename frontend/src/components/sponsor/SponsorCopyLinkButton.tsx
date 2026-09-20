'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

export function SponsorCopyLinkButton({
  url,
  title,
  label = 'Share',
  showUrl = false,
}: {
  url: string
  title?: string
  label?: string
  showUrl?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const share = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!url) return

    const shareTitle = title || 'Help fund this cleanup'
    const shareText = `${shareTitle}\n${url}`

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: shareTitle, text: shareText, url })
        return
      }
    } catch (err) {
      if (err instanceof Error && /AbortError|canceled|cancelled/i.test(err.name + err.message)) {
        return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={(e) => void share(e)}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-brand-green/40 bg-brand-green/15 px-3 text-xs font-medium text-brand-green hover:bg-brand-green/25"
        aria-label={copied ? 'Link copied' : `Share ${title || 'cleanup'}`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        {copied ? 'Link copied' : label}
      </button>
      {showUrl && url ? (
        <p className="break-all rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11px] text-zinc-500">
          {url}
        </p>
      ) : null}
    </div>
  )
}
