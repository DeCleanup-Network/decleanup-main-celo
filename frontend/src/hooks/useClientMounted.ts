'use client'

import { useEffect, useState } from 'react'

/** Avoid SSR/client mismatch for wallet and session-dependent UI. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
