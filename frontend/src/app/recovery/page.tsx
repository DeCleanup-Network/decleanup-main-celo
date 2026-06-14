'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy route — wallet sync + unlock live on Account settings. */
export default function RecoveryPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/wallet')
  }, [router])

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-gray-400">
      Redirecting to account settings…
    </div>
  )
}
