'use client'

import { SessionProvider } from 'next-auth/react'

export function AaSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
