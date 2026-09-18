'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Ops admin create is retired. Verifiers review funding apps in the verifier cabinet. */
export default function SponsorAdminRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/verifier')
  }, [router])
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 text-sm text-gray-400">
      Redirecting to verifier cabinet…
    </main>
  )
}
