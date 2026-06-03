'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ShareRedirectProps {
    redirectUrl: string
}

export function ShareRedirect({ redirectUrl }: ShareRedirectProps) {
    useEffect(() => {
        // Small delay to ensure crawlers can read meta tags
        const timer = setTimeout(() => {
            window.location.href = redirectUrl
        }, 100)

        return () => clearTimeout(timer)
    }, [redirectUrl])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
            <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-green" />
                <h1 className="mb-2 font-heading text-2xl uppercase tracking-wide text-foreground">
                    Redirecting...
                </h1>
                <p className="text-sm text-muted-foreground">
                    Taking you to DeCleanup Rewards
                </p>
            </div>
        </div>
    )
}
