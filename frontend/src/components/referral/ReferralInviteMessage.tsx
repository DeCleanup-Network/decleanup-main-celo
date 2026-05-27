import type { ReactNode } from 'react'

type Props = {
  /** e.g. home: “Submit” button row; cleanup: “Start below…” note */
  afterRewards?: ReactNode
}

/**
 * Shared copy for “you’ve been referred” — use on home and /cleanup so text never drifts.
 */
export function ReferralInviteMessage({ afterRewards }: Props) {
  return (
    <>
      <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">You&apos;ve been referred</h3>
      <p className="text-sm text-gray-300">Someone shared DeCleanup Rewards with you. Follow these steps in order:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-300">
        <li>Submit your first cleanup (before and after photos).</li>
        <li>Wait for verification — a human verifier approves it onchain.</li>
        <li>Claim your first Impact Product level in the app.</li>
      </ol>
      <p className="mt-2 text-sm text-gray-300">
        When you <strong className="text-white">claim that first level</strong>, you get the normal{' '}
        <strong className="text-white">10 DCU</strong> first-level reward for the cleanup, and the referral program
        pays <strong className="text-white">3 DCU</strong> to you and <strong className="text-white">3 DCU</strong> to
        the person who referred you — in the same step.
      </p>
      {afterRewards}
    </>
  )
}
