'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function CreateHypercertPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/hypercerts')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting to Hypercerts Certification...
      </div>
    </div>
  )
}
