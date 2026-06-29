'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'
import Link from 'next/link'
import {
  chunkLoadErrorMessage,
  isChunkLoadError,
  reloadOnceForStaleChunk,
} from '@/lib/utils/chunk-load-error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const staleChunk = isChunkLoadError(error)

  useEffect(() => {
    console.error('Application error:', error)
    if (staleChunk) reloadOnceForStaleChunk()
  }, [error, staleChunk])

  const handleRetry = () => {
    if (staleChunk) {
      window.location.reload()
      return
    }
    reset()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
          Something went wrong!
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          {staleChunk
            ? chunkLoadErrorMessage()
            : process.env.NODE_ENV === 'development'
              ? error.message || 'An unexpected error occurred'
              : 'An unexpected error occurred. Please try again or return home.'}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-gray-500 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={handleRetry}>
            {staleChunk ? 'Refresh page' : 'Try again'}
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

