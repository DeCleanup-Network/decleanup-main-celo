import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

/** Uses root MinimalWagmiProviders — do not nest a second Wagmi/RainbowKit tree here. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">Loading…</div>}>
      {children}
    </Suspense>
  )
}
