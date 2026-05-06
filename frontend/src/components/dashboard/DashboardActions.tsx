'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Leaf, Award, Loader2, Clock, Shield, Heart, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeeDisplay } from '@/components/ui/fee-display'
import { ActionHint } from '@/components/ui/action-hint'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { MAX_IMPACT_PRODUCT_LEVEL } from '@/lib/blockchain/chain-constants'
import { VERIFIER_CONFIG } from '@/config/verifier'
import { useVerifierEligibility } from '@/hooks/useVerifierEligibility'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { isVerifier as isVerifierOnChain } from '@/lib/blockchain/contracts'
import type { Address } from 'viem'

interface DashboardActionsProps {
    address: string
    /** Current Impact Product level (0-10). At max level, submit cleanup is locked. */
    userImpactLevel?: number
    cleanupStatus: {
        hasPendingCleanup: boolean
        canClaim: boolean
        cleanupId?: bigint
        level?: number
    } | null
    onClaim: () => Promise<void>
    isClaiming: boolean
    claimFeeInfo?: { fee: bigint; enabled: boolean } | null
    onNotify?: (params: { variant: 'success' | 'info'; title: string; message: string }) => void
}

function stepClass(active: boolean, done?: boolean) {
    const base =
        'inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-center font-bebas text-[11px] uppercase tracking-wide transition-colors sm:text-xs'
    if (done) {
        return `${base} border-brand-green/40 bg-brand-green/10 text-brand-green`
    }
    if (active) {
        return `${base} border-brand-green bg-brand-green/15 text-foreground ring-1 ring-brand-green/40`
    }
    return `${base} border-border/80 bg-background/40 text-muted-foreground opacity-70`
}

export function DashboardActions({
    address,
    userImpactLevel = 0,
    cleanupStatus,
    onClaim,
    isClaiming,
    claimFeeInfo,
    onNotify: _onNotify,
}: DashboardActionsProps) {
    const { submissionOwnerAddress } = useSmartAccountClient()
    const { eligibility } = useVerifierEligibility()
    const [isVerifier, setIsVerifier] = useState(false)

    const rewardIdentity = submissionOwnerAddress ?? (address as Address | undefined)

    useEffect(() => {
        let cancelled = false
        if (!rewardIdentity) {
            setIsVerifier(false)
            return
        }
        void isVerifierOnChain(rewardIdentity as Address).then((v) => {
            if (!cancelled) setIsVerifier(v)
        })
        return () => {
            cancelled = true
        }
    }, [rewardIdentity])

    const canSubmit = !cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim
    const submitLockedMaxLevel = userImpactLevel >= MAX_IMPACT_PRODUCT_LEVEL
    const submitAvailable = canSubmit && !submitLockedMaxLevel
    const canClaimLevel = cleanupStatus?.canClaim && !isClaiming
    const isUnderVerification = cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim

    const hypercertHighlighted = userImpactLevel > 0 && userImpactLevel % 10 === 0
    const verifierHighlighted = !isVerifier && !!eligibility?.eligible

    const { minLevel, minDCUBalance, minApprovedCleanups } = VERIFIER_CONFIG.requirements
    const verifierApplyTitle = `Apply if you meet all requirements: Impact Product level ${minLevel}+, ${minDCUBalance}+ DCU points, and ${minApprovedCleanups}+ verified cleanups. Open to apply or check your status.`

    const bonusExplicitlyOff =
        process.env.NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM === '0' ||
        process.env.NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM?.toLowerCase() === 'false'

    return (
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card p-4 sm:p-6">
            <SectionHeading icon={Leaf}>ACTIONS</SectionHeading>

            <div className="flex flex-wrap justify-center gap-2 pb-1 sm:gap-2.5">
                {submitAvailable ? (
                    <ActionHint hint="Upload photos and optional impact report">
                        <Link href="/cleanup" className={stepClass(true)}>
                            <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Submit cleanup
                        </Link>
                    </ActionHint>
                ) : (
                    <ActionHint
                        hint={
                            submitLockedMaxLevel
                                ? 'Maximum Impact Product level reached'
                                : 'Finish your current cleanup step first'
                        }
                    >
                        <span className={stepClass(false)}>
                            <Leaf className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                            Submit cleanup
                        </span>
                    </ActionHint>
                )}

                <ActionHint
                    hint={
                        isUnderVerification
                            ? 'Usually takes 2-12 hours, come back later'
                            : 'Shown while a cleanup is waiting for verifier review'
                    }
                >
                    <span className={stepClass(isUnderVerification)}>
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Wait for verification
                    </span>
                </ActionHint>

                {cleanupStatus?.canClaim ? (
                    <ActionHint hint="Get your Impact Product and level-tied rewards">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (canClaimLevel && onClaim) {
                                    void onClaim().catch(() => {})
                                }
                            }}
                            disabled={!canClaimLevel}
                            className={`${stepClass(true)} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {isClaiming ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                            ) : (
                                <Award className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                            Claim level
                        </button>
                    </ActionHint>
                ) : (
                    <ActionHint hint="Get your Impact Product and level-tied rewards (available after a cleanup is verified)">
                        <span className={stepClass(false)}>
                            <Award className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                            Claim level
                        </span>
                    </ActionHint>
                )}

                <ActionHint hint={isVerifier ? 'You are a verifier' : verifierApplyTitle}>
                    <Link href="/verifier" className={stepClass(verifierHighlighted, isVerifier)}>
                        {isVerifier ? (
                            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                            <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        {isVerifier ? 'Verifier' : 'Become verifier'}
                    </Link>
                </ActionHint>

                <ActionHint hint="Advanced documentation of your action with Hypercert impact certificate">
                    <Link href="/hypercerts" className={stepClass(hypercertHighlighted)}>
                        <Heart className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Impact certificate
                    </Link>
                </ActionHint>
            </div>

            <div className="mx-auto mt-4 w-full max-w-2xl border-t border-border/50 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
                    <div className="relative w-full">
                        <span className="absolute right-2 top-2 z-[1] rounded border border-border bg-background/95 px-1.5 py-0.5 text-[9px] font-bebas text-muted-foreground shadow-sm">
                            SOON
                        </span>
                        <Button
                            type="button"
                            disabled
                            variant="outline"
                            className="h-auto min-h-[3.25rem] w-full cursor-not-allowed border-dashed px-3 py-4 pr-14 pt-9 text-center font-bebas text-sm leading-tight text-muted-foreground sm:min-h-[3.5rem] sm:px-4"
                        >
                            Create Impact Circle
                        </Button>
                    </div>
                    <div className="relative w-full">
                        <span className="absolute right-2 top-2 z-[1] rounded border border-border bg-background/95 px-1.5 py-0.5 text-[9px] font-bebas text-muted-foreground shadow-sm">
                            SOON
                        </span>
                        <Button
                            type="button"
                            disabled
                            variant="outline"
                            className="h-auto min-h-[3.25rem] w-full cursor-not-allowed border-dashed px-3 py-4 pr-14 pt-9 text-center font-bebas text-sm leading-tight text-muted-foreground sm:min-h-[3.5rem] sm:px-4"
                        >
                            Join Impact Circle
                        </Button>
                    </div>
                </div>
            </div>

            {cleanupStatus?.canClaim && claimFeeInfo && claimFeeInfo.enabled && claimFeeInfo.fee > 0n ? (
                <div className="mt-3 flex justify-center">
                    <FeeDisplay feeAmount={claimFeeInfo.fee} feeSymbol="CELO" type="claim" className="mt-1" />
                </div>
            ) : null}

            {bonusExplicitlyOff ? (
                <p className="mx-auto mt-3 max-w-lg rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center text-[11px] text-muted-foreground">
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">Bonus claim is off in this build.</span>{' '}
                    Set <span className="font-mono text-[10px]">NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM=1</span> so
                    impact report and recyclables DCU are written to the reward manager after Claim level.
                </p>
            ) : null}
        </div>
    )
}
