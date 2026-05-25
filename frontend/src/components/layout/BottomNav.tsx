'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShieldCheck } from 'lucide-react'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'

export function BottomNav() {
  const pathname = usePathname()
  const { showVerifierFeatures } = useVerifierAccess()

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Home',
      active: pathname === '/',
    },
    ...(showVerifierFeatures
      ? [
          {
            href: '/verifier',
            icon: ShieldCheck,
            label: 'Verify Cleanups',
            active: pathname === '/verifier',
          },
        ]
      : []),
  ]

  if (pathname === '/verifier' && !showVerifierFeatures) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom pb-safe">
      <div className="container mx-auto">
        <div className={`flex items-center ${navItems.length === 3 ? 'justify-around' : 'justify-evenly'} px-2 py-3`}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors touch-manipulation ${
                  item.active
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[10px] font-medium uppercase leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
