'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Leaf, Award, Loader2 } from 'lucide-react'
import { FeeDisplay } from '@/components/ui/fee-display'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { MAX_IMPACT_PRODUCT_LEVEL } from '@/lib/blockchain/chain-constants'

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

export function DashboardActions({
    address,
    userImpactLevel = 0,
    cleanupStatus,
    onClaim,
    isClaiming,
    claimFeeInfo,
    onNotify,
}: DashboardActionsProps) {
    // Button state logic:
    // 1. Can submit: no pending cleanup, cannot claim → Submit active, Claim hidden
    // 2. Under verification: has pending cleanup, cannot claim → Both hidden, show status
    // 3. Verified: has pending cleanup, can claim → Claim active, Submit hidden
    const canSubmit = !cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim
    const submitLockedMaxLevel = userImpactLevel >= MAX_IMPACT_PRODUCT_LEVEL
    const canClaimLevel = cleanupStatus?.canClaim && !isClaiming
    const isUnderVerification = cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim
    
    // Debug logging - only log when there's something actionable or unexpected
    if (cleanupStatus?.canClaim) {
        console.log('[DashboardActions] ✅ Claim button available:', {
            cleanupId: cleanupStatus.cleanupId?.toString(),
            level: cleanupStatus.level,
        })
    } else if (cleanupStatus?.hasPendingCleanup && !cleanupStatus.canClaim) {
        // Under verification - this is expected, no need to log
    } else if (!cleanupStatus) {
        // No cleanup status - normal for new users, no need to log
    }
    // If cleanupStatus exists but canClaim is false and hasPendingCleanup is false,
    // this is also normal (e.g., all cleanups claimed, or no cleanups yet)

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6">
            <SectionHeading icon={Leaf}>ACTIONS</SectionHeading>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                {/* Submit Cleanup Button - Only show when user can submit */}
                {canSubmit && !submitLockedMaxLevel && (
                    <Link href="/cleanup">
                        <Button
                            className="w-full gap-2 bg-brand-green py-4 sm:py-5 font-bebas text-lg sm:text-xl tracking-wider text-black hover:bg-brand-green/90 transition-all"
                        >
                            <Leaf className="h-5 w-5" />
                            SUBMIT CLEANUP
                        </Button>
                    </Link>
                )}

                {canSubmit && submitLockedMaxLevel && (
                    <div className="rounded-lg border border-muted-foreground/40 bg-muted/20 p-4 space-y-2">
                        <p className="font-bebas text-lg tracking-wide text-muted-foreground">
                            SUBMIT CLEANUP LOCKED
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            You&apos;ve reached Impact Product level {MAX_IMPACT_PRODUCT_LEVEL} (the maximum). New cleanup
                            submissions are closed for this program phase. Your completed journey is reflected in your
                            stats, Hypercerts, and public impact portfolio.
                        </p>
                    </div>
                )}

                {/* Claim Level Button - Only show when verified and can claim */}
                {cleanupStatus?.canClaim && (
                    <div className="space-y-3" style={{ position: 'relative', zIndex: 10 }}>
                        <div className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 p-3 sm:p-4">
                            <p className="text-sm sm:text-base text-brand-yellow">
                                🎉 Your cleanup has been verified! You can now claim your Impact Product (Level {cleanupStatus.level || 1}).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('[DashboardActions] Claim button clicked', {
                                canClaimLevel,
                                isClaiming,
                                cleanupId: cleanupStatus?.cleanupId?.toString(),
                                hasOnClaim: !!onClaim,
                              })
                              if (canClaimLevel && !isClaiming && onClaim) {
                                console.log('[DashboardActions] Calling onClaim...')
                                onClaim().catch((error) => {
                                  console.error('[DashboardActions] Error in onClaim:', error)
                                })
                              } else {
                                console.warn('[DashboardActions] Claim button click ignored:', {
                                  canClaimLevel,
                                  isClaiming,
                                  hasOnClaim: !!onClaim,
                                })
                              }
                            }}
                            disabled={!canClaimLevel}
                            className="w-full gap-2 bg-brand-yellow py-4 sm:py-5 font-bebas text-lg sm:text-xl tracking-wider text-black hover:bg-[#e6e600] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center rounded-md transition-all"
                        >
                            {isClaiming ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    CLAIMING...
                                </>
                            ) : (
                                <>
                                    <Award className="h-5 w-5" />
                                    CLAIM LEVEL
                                </>
                            )}
                        </button>
                        {/* Claim Fee Display */}
                        {claimFeeInfo && claimFeeInfo.enabled && claimFeeInfo.fee > 0n && (
                            <div className="mt-3">
                                <FeeDisplay
                                    feeAmount={claimFeeInfo.fee}
                                    feeSymbol="CELO"
                                    type="claim"
                                    className="mt-2"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Pending Status - Show when under verification (both buttons hidden) */}
                {isUnderVerification && (
                    <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 p-3 sm:p-4">
                        <p className="mb-2 font-bebas text-lg sm:text-xl tracking-wide text-brand-green">
                            ⏳ UNDER REVIEW
                        </p>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            Your cleanup is being verified. This usually takes a few hours.
                        </p>
                    </div>
                )}

                {/* Future Features - Coming Soon */}
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <p className="mb-3 text-sm sm:text-base font-bebas tracking-wide text-muted-foreground uppercase">COMING SOON</p>
                    <Button
                        disabled
                        variant="outline"
                        size="sm"
                        className="w-full border-border/50 font-bebas text-xs sm:text-sm tracking-wider text-muted-foreground opacity-50 cursor-not-allowed py-2 h-auto"
                        title="Coming Soon"
                    >
                        CREATE IMPACT CIRCLE
                    </Button>
                    <Button
                        disabled
                        variant="outline"
                        size="sm"
                        className="w-full border-border/50 font-bebas text-xs sm:text-sm tracking-wider text-muted-foreground opacity-50 cursor-not-allowed py-2 h-auto"
                        title="Coming Soon"
                    >
                        JOIN IMPACT CIRCLE
                    </Button>
                </div>
            </div>
        </div>
    )
}
