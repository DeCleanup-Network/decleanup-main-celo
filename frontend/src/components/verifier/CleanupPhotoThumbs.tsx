'use client'

import { useState } from 'react'
import { hashToProxyDisplayUrl } from '@/lib/impact/public-portfolio-shared'
import { normalizeIpfsCid } from '@/lib/utils/ipfs-fetch-gateways'

const PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EPhoto%3C/text%3E%3C/svg%3E'

function photoSrc(hash: string): string {
  const cid = normalizeIpfsCid(hash)
  if (!cid) return ''
  return hashToProxyDisplayUrl(cid) || `/api/ipfs/fetch?cid=${encodeURIComponent(cid)}`
}

function PhotoThumb({ hash, label }: { hash: string; label: string }) {
  const cid = normalizeIpfsCid(hash)
  const [src, setSrc] = useState(() => photoSrc(hash))
  const [usedCidFallback, setUsedCidFallback] = useState(false)

  if (!cid) {
    return (
      <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
        {label}
      </div>
    )
  }

  return (
    <img
      src={src || PLACEHOLDER}
      alt={label}
      className="h-32 w-full object-cover"
      onError={(e) => {
        const img = e.currentTarget
        if (!usedCidFallback) {
          setUsedCidFallback(true)
          const fallback = `/api/ipfs/fetch?cid=${encodeURIComponent(cid)}`
          setSrc(fallback)
          img.src = fallback
          return
        }
        img.src = PLACEHOLDER
      }}
    />
  )
}

export function CleanupPhotoThumbs({
  beforeHash,
  afterHash,
}: {
  beforeHash: string
  afterHash: string
}) {
  return (
    <div className="grid grid-cols-2 gap-1 bg-gray-900">
      <PhotoThumb hash={beforeHash} label="Before" />
      <PhotoThumb hash={afterHash} label="After" />
    </div>
  )
}
