'use client'

import dynamic from 'next/dynamic'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'

const VerifierApplyCard = dynamic(
  () => import('@/components/dashboard/VerifierApplyCard').then((m) => ({ default: m.VerifierApplyCard })),
  { ssr: false }
)

export function DashboardVerifierExtras() {
  const { showVerifierApplyCard } = useVerifierAccess({
    defer: true,
  })

  return showVerifierApplyCard ? <VerifierApplyCard /> : null
}
