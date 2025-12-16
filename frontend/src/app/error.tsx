'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
          Something went wrong!
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-gray-500 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-brand-green text-black hover:bg-brand-green/90"
          >
            Try again
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

