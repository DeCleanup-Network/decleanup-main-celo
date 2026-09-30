import { Home } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-wide text-white">
          404 - Page Not Found
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-brand-green bg-brand-green px-4 font-heading text-sm font-semibold uppercase tracking-wide text-[#0a0a0a]"
          >
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
