'use client'

import { lazy, Suspense, type ReactNode } from 'react'

const RainbowKitProviders = lazy(() =>
  import('@/lib/RainbowKitProviders').then((m) => ({ default: m.RainbowKitProviders }))
)

/** RainbowKit only on login — keeps AA app shell on minimal wagmi elsewhere. */
export function LoginRainbowKitProviders({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="py-16 text-center text-gray-400">Loading wallet connect…</div>}
    >
      <RainbowKitProviders>{children}</RainbowKitProviders>
    </Suspense>
  )
}
