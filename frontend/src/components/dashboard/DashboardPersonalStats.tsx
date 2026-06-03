'use client'

import { useState } from 'react'
import { TrendingUp, Flame, Users, FileText, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PersonalStatsProps {
    dcuBalance: number
    cleanupsDone: number
    cleanupsDCU: number
    referrals: number
    referralsDCU: number
    streakWeeks: number
    streakDCU: number
    enhancedReportsDCU: number
    hasActiveStreak: boolean
}

export function DashboardPersonalStats({
    dcuBalance,
    cleanupsDone,
    cleanupsDCU,
    referrals,
    referralsDCU,
    streakWeeks,
    streakDCU,
    enhancedReportsDCU,
    hasActiveStreak,
}: PersonalStatsProps) {
    const [showEarnModal, setShowEarnModal] = useState(false)

    return (
        <div className="rounded-xl border-2 border-brand-green/30 bg-gradient-to-b from-brand-green/10 to-black p-3 flex flex-col h-full min-h-0 overflow-y-auto">
            <h2 className="mb-3 border-b border-brand-green/30 pb-2 font-heading text-2xl tracking-wider text-brand-green flex-shrink-0">
                PERSONAL STATS
            </h2>

            <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto">
                {/* Total cDCU */}
                <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="font-sans text-sm font-semibold text-gray-400">Total DCU</span>
                        <TrendingUp className="h-4 w-4 text-brand-green" />
                    </div>
                    <p className="font-heading text-3xl text-brand-green">{dcuBalance.toFixed(0)}</p>
                </div>

                {/* Streak Information */}
                <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2.5">
                    <div className="mb-1 flex items-center justify-between">
                        <span className="font-heading text-sm tracking-wide text-gray-400">STREAK</span>
                        <Flame className={`h-4 w-4 ${hasActiveStreak ? 'text-brand-yellow' : 'text-gray-500'}`} />
                    </div>
                    <p className="font-heading text-2xl text-white">{streakWeeks} {streakWeeks === 1 ? 'Week' : 'Weeks'}</p>
                    {hasActiveStreak && (
                        <p className="mt-1 text-xs text-brand-yellow">Active - Keep it up!</p>
                    )}
                </div>

                {/* Breakdown */}
                <div className="w-full max-w-sm space-y-1 rounded-lg border border-brand-green/20 bg-black/50 p-2">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <TrendingUp className="h-3 w-3 text-brand-green" />
                            Cleanups Done
                        </span>
                        <span className="font-heading text-base text-brand-green">{cleanupsDCU} DCU</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Users className="h-3 w-3 text-brand-green" />
                            Referrals ({referrals})
                        </span>
                        <span className="font-heading text-base text-brand-green">{referralsDCU} DCU</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Flame className="h-3 w-3 text-brand-yellow" />
                            Streak Bonus
                        </span>
                        <span className="font-heading text-base text-brand-green">{streakDCU} DCU</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <FileText className="h-3 w-3 text-brand-green" />
                            Enhanced Reports
                        </span>
                        <span className="font-heading text-base text-brand-green">{enhancedReportsDCU} DCU</span>
                    </div>
                </div>

                {/* Learn More Button */}
                <Button
                    onClick={() => setShowEarnModal(true)}
                    variant="outline"
                    className="w-full border-brand-green/30 font-heading tracking-wider text-brand-green hover:bg-brand-green/10"
                >
                    <Info className="mr-2 h-4 w-4" />
                    Learn how to earn more DCU
                </Button>
            </div>

            {/* Earn More Modal */}
            {showEarnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowEarnModal(false)}>
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border-2 border-brand-green/30 bg-black p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-4 font-heading text-3xl tracking-wider text-brand-green">
                            DCU &amp; HOW TO EARN MORE
                        </h3>

                        <div className="mb-6 space-y-3 rounded-lg border border-brand-green/25 bg-black/40 p-4 text-sm text-gray-300">
                            <p>
                                <span className="font-semibold text-white">What is DCU?</span> DCU are onchain participation
                                points for cleanups, referrals, streaks, reports, verifier work, Hypercerts, and related
                                activity.
                            </p>
                            <p>
                                <span className="font-semibold text-white">Converting to $cDCU.</span> Every{' '}
                                <span className="font-bold text-brand-green">50 DCU</span> slice can unlock a dashboard claim;
                                minted amounts can scale with an activity multiplier.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">1</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Impact Products</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">10 DCU</span> per level with verified
                                    before-and-after photos. Ten levels are live today.
                                </p>
                            </div>

                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">2</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Referrals</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">3 DCU</span> when someone uses your link
                                    and completes a verified cleanup.
                                </p>
                            </div>

                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">3</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Streaks</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">3 DCU</span> per streak level by
                                    submitting at least one cleanup each week.
                                </p>
                            </div>

                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">4</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Reports &amp; recyclables</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">5 DCU</span> for each verified impact
                                    report or recyclables submission.
                                </p>
                            </div>

                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">5</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Verifier work</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">1 DCU</span> per reviewed submission—
                                    approve or reject with a reason—as an active verifier.
                                </p>
                            </div>

                            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green font-heading text-lg text-black">6</span>
                                    <h4 className="font-heading text-xl tracking-wide text-brand-green">Impact certificates</h4>
                                </div>
                                <p className="text-sm text-gray-300">
                                    Earn <span className="font-bold text-brand-green">10 DCU</span> for every ten verified
                                    cleanups when you create a Hypercert.
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={() => setShowEarnModal(false)}
                            className="mt-6 w-full bg-brand-green font-heading text-lg tracking-wider text-black hover:bg-brand-green/90"
                        >
                            Got it
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
