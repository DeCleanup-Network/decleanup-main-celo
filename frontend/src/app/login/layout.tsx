import { Suspense } from 'react'
import { LoginRainbowKitProviders } from '@/lib/auth/LoginRainbowKitProviders'

export const dynamic = 'force-dynamic'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoginRainbowKitProviders>
      <Suspense fallback={<div className="py-16 text-center text-gray-400">Loading…</div>}>
        {children}
      </Suspense>
    </LoginRainbowKitProviders>
  )
}
