'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'

export function OptionalSubmissionVideo({ submissionId }: { submissionId: string }) {
  const [videoCid, setVideoCid] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/impact/cleanup-media?submissionId=${encodeURIComponent(submissionId)}`)
      .then((res) => res.json())
      .then((data: { optionalVideoCid?: string | null }) => {
        if (!cancelled && data.optionalVideoCid) {
          setVideoCid(data.optionalVideoCid)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [submissionId])

  if (!videoCid) return null

  const url = getIPFSUrl(videoCid)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-green underline underline-offset-2"
    >
      Optional cleanup video
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  )
}
