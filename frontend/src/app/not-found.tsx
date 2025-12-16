'use client'

import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
          404 - Page Not Found
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button className="bg-brand-green text-black hover:bg-brand-green/90">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-gray-700 text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

