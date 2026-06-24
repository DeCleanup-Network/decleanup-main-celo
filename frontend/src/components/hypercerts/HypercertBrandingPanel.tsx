'use client'

import { useRef } from 'react'
import { CheckCircle2, Circle, ImageUp, Loader2 } from 'lucide-react'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import {
  clampHypercertDescription,
  clampHypercertTitle,
  countGraphemes,
  HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES,
  HYPERCERT_BRANDING_MAX_TITLE,
  HYPERCERT_BRANDING_MIN_DESCRIPTION,
  HYPERCERT_BRANDING_MIN_TITLE,
  type BrandingReadiness,
} from '@/lib/blockchain/hypercerts/branding-readiness'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  description: string
  coverImageCid?: string
  coverFile: File | null
  coverUploading: boolean
  coverUploadError?: string | null
  readiness: BrandingReadiness
  textComplete?: boolean
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCoverFileSelect: (file: File | null) => void
}

function CharacterCounter({
  current,
  max,
  min,
}: {
  current: number
  max: number
  min?: number
}) {
  const atLimit = current >= max
  const belowMin = min !== undefined && current > 0 && current < min

  return (
    <span
      className={cn(
        'text-[11px] tabular-nums',
        atLimit ? 'text-red-400' : belowMin ? 'text-muted-foreground' : 'text-muted-foreground'
      )}
      aria-live="polite"
    >
      {current} / {max}
    </span>
  )
}

export function HypercertBrandingPanel({
  title,
  description,
  coverImageCid,
  coverFile,
  coverUploading,
  coverUploadError,
  readiness,
  textComplete = false,
  onTitleChange,
  onDescriptionChange,
  onCoverFileSelect,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrl = coverImageCid ? getIPFSUrl(coverImageCid) : null
  const coverStored = Boolean(coverImageCid)
  const titleLength = title.length
  const descriptionLength = countGraphemes(description)

  return (
    <section
      className={cn(
        'rounded-3xl border bg-card p-6 sm:p-8',
        readiness.ready
          ? 'border-brand-green/40'
          : textComplete
            ? 'border-brand-green/25'
            : 'border-border'
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl uppercase tracking-wider text-foreground sm:text-3xl">
          Step 2: Certificate details
        </h2>
        <span
          className={cn(
            'h-4 w-4 rounded-full border',
            readiness.ready
              ? 'border-brand-green bg-brand-green'
              : textComplete
                ? 'border-brand-green/60 bg-brand-green/40'
                : 'border-muted-foreground'
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
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="hypercert-title" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Title
            </label>
            <CharacterCounter
              current={titleLength}
              max={HYPERCERT_BRANDING_MAX_TITLE}
              min={HYPERCERT_BRANDING_MIN_TITLE}
            />
          </div>
          <input
            id="hypercert-title"
            type="text"
            value={title}
            maxLength={HYPERCERT_BRANDING_MAX_TITLE}
            onChange={(e) => onTitleChange(clampHypercertTitle(e.target.value))}
            placeholder="e.g. Koh Phangan beach cleanup, Q2 2026"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
          />
          <p className="text-xs text-muted-foreground">
            {HYPERCERT_BRANDING_MIN_TITLE}–{HYPERCERT_BRANDING_MAX_TITLE} characters. Shown as your certificate
            name on Hyperscan.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="hypercert-description"
              className="text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Short description
            </label>
            <CharacterCounter
              current={descriptionLength}
              max={HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES}
              min={HYPERCERT_BRANDING_MIN_DESCRIPTION}
            />
          </div>
          <textarea
            id="hypercert-description"
            value={description}
            onChange={(e) => onDescriptionChange(clampHypercertDescription(e.target.value))}
            placeholder="What impact does this certificate represent?"
            className="h-24 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
          />
          <p className="text-xs text-muted-foreground">
            {HYPERCERT_BRANDING_MIN_DESCRIPTION}–{HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES} characters. Extra
            text is blocked at the limit.
          </p>
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
              <span className="text-xs text-muted-foreground">Landscape works best. JPEG or PNG, max 12 MB.</span>
            )}
          </button>
          {coverUploadError ? (
            <p className="text-xs text-red-400" role="alert">
              {coverUploadError}
            </p>
          ) : null}
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
