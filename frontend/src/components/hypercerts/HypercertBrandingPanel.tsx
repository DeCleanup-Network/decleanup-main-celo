'use client'

import { useRef } from 'react'
import { CheckCircle2, Circle, ImageUp, Loader2 } from 'lucide-react'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { BrandingReadiness } from '@/lib/blockchain/hypercerts/branding-readiness'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  description: string
  coverImageCid?: string
  coverFile: File | null
  coverUploading: boolean
  readiness: BrandingReadiness
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCoverFileSelect: (file: File | null) => void
}

export function HypercertBrandingPanel({
  title,
  description,
  coverImageCid,
  coverFile,
  coverUploading,
  readiness,
  onTitleChange,
  onDescriptionChange,
  onCoverFileSelect,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrl = coverImageCid ? getIPFSUrl(coverImageCid) : null
  const coverStored = Boolean(coverImageCid)

  return (
    <section
      className={cn(
        'rounded-3xl border bg-card p-6 sm:p-8',
        readiness.ready ? 'border-brand-green/40' : 'border-border'
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
          Step 2: Certificate details
        </h2>
        <span
          className={cn(
            'h-4 w-4 rounded-full border',
            readiness.ready ? 'border-brand-green bg-brand-green' : 'border-muted-foreground'
          )}
          aria-hidden
        />
      </div>

      <ul className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border/80 bg-background/40 p-3">
        {readiness.checks.map((check) => (
          <li key={check.id} className="flex items-center gap-2 text-xs">
            {check.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={check.ok ? 'text-foreground' : 'text-muted-foreground'}>{check.label}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="hypercert-title" className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Title
          </label>
          <input
            id="hypercert-title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Koh Phangan beach cleanup, Q2 2026"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="hypercert-description"
            className="text-[11px] uppercase tracking-widest text-muted-foreground"
          >
            Short description
          </label>
          <textarea
            id="hypercert-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What impact does this certificate represent?"
            className="h-24 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
          />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Cover image</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onCoverFileSelect(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={coverUploading}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center transition-colors hover:border-border hover:bg-muted/20 disabled:opacity-60"
          >
            {coverUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <ImageUp className="h-6 w-6 text-muted-foreground" aria-hidden />
            )}
            <span className="font-heading text-xs uppercase tracking-wide text-foreground">Choose file</span>
            {coverStored && coverFile ? (
              <span className="text-xs text-brand-green">{coverFile.name}: upload complete</span>
            ) : coverFile && coverUploading ? (
              <span className="text-xs text-muted-foreground">{coverFile.name}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Landscape works best.</span>
            )}
          </button>
        </div>
      </div>

      {previewUrl ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="aspect-[16/7] w-full object-cover" />
        </div>
      ) : null}
    </section>
  )
}
