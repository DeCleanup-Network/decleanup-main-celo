'use client'

import dynamic from 'next/dynamic'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'

const VerifierApplyCard = dynamic(
  () => import('@/components/dashboard/VerifierApplyCard').then((m) => ({ default: m.VerifierApplyCard })),
  { ssr: false }
)

export function DashboardVerifierExtras() {
  const { showVerifierApplyCard, onChainRoleWithoutApplication, rewardIdentity } = useVerifierAccess({
    defer: true,
  })

  return (
    <>
      {showVerifierApplyCard ? <VerifierApplyCard /> : null}
      {onChainRoleWithoutApplication && rewardIdentity ? (
        <p className="text-xs text-amber-300/90">
          Onchain verifier role is set for{' '}
          <span className="font-mono">{rewardIdentity.slice(0, 10)}…</span> but no approved application — verifier UI
          stays off until the team approves an application or revokes the role.
        </p>
      ) : null}
    </>
  )
}
