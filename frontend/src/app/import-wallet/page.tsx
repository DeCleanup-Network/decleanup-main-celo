'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy route — sign in and unlock on Account settings instead. */
export default function ImportWalletPage() {
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
