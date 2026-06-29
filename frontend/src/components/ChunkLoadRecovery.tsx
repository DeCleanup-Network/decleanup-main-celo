'use client'

import { useEffect } from 'react'
import { isChunkLoadError, reloadOnceForStaleChunk } from '@/lib/utils/chunk-load-error'

/**
 * Catches stale lazy-chunk failures (e.g. after Vercel deploy) before they hit error.tsx.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return
      event.preventDefault()
      reloadOnceForStaleChunk()
    }

    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadError(event.error ?? event.message)) return
      reloadOnceForStaleChunk()
    }

    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}
