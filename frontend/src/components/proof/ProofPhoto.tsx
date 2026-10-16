'use client'

import { useState } from 'react'
import { cidFromMediaUrl } from '@/lib/proof/impact-api'

export function ProofPhoto({
  src,
  label,
  variant = 'full',
}: {
  src: string
  label: string
  variant?: 'full' | 'thumb'
}) {
  const cid = cidFromMediaUrl(src)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [triedCid, setTriedCid] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <figure className="space-y-2">
        <div
          className={
            variant === 'thumb'
              ? 'flex h-28 w-full items-center justify-center rounded-xl border border-white/10 bg-elevated text-xs text-muted-foreground sm:h-32'
              : 'flex min-h-[12rem] w-full items-center justify-center rounded-xl border border-white/10 bg-elevated text-sm text-muted-foreground'
          }
        >
          Photo unavailable
        </div>
        <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
      </figure>
    )
  }

  return (
    <figure className="space-y-2">
      <img
        src={currentSrc}
        alt={label}
        className={
          variant === 'thumb'
            ? 'h-28 w-full rounded-xl object-cover sm:h-32'
            : 'h-auto min-h-[12rem] w-full rounded-xl object-cover'
        }
        onError={() => {
          if (!triedCid && cid) {
            setTriedCid(true)
            setCurrentSrc(`/api/ipfs/fetch?cid=${encodeURIComponent(cid)}`)
            return
          }
          setFailed(true)
        }}
      />
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
