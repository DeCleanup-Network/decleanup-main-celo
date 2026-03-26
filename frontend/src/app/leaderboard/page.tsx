'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Trophy, ArrowLeft, MapPin, Loader2, Award } from 'lucide-react'
import { getLeaderboardData, type LeaderboardUser } from '@/lib/utils/leaderboard'
import { formatEther } from 'viem'

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount()
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number | null>(null)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (isConnected && address && leaderboard.length > 0) {
      // Find user's rank
      const rank = leaderboard.findIndex((u) => u.address.toLowerCase() === address.toLowerCase())
      if (rank !== -1) {
        setUserRank(rank + 1)
      } else {
        // User not in top 10, show as ">10"
        setUserRank(null)
      }
    }
  }, [isConnected, address, leaderboard])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const data = await getLeaderboardData()
      setLeaderboard(data)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-amber-600'
    return 'text-muted-foreground'
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-bebas text-sm tracking-wider">BACK</span>
            </Button>
          </Link>
        </div>

        {/* Title */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <Trophy className="h-8 w-8 text-brand-yellow" />
            <h1 className="font-bebas text-4xl tracking-wider text-foreground sm:text-5xl">
              LEADERBOARD
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Top contributors by total DCU earned
          </p>
        </div>

        {/* User Rank Banner */}
        {isConnected && address && userRank !== null && (
          <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">YOUR RANK</p>
                <p className="font-bebas text-2xl text-brand-green">
                  #{userRank}
                </p>
              </div>
              <Award className="h-8 w-8 text-brand-green" />
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 font-bebas text-2xl tracking-wider text-foreground">
              NO RANKINGS YET
            </h3>
            <p className="text-sm text-muted-foreground">
              Be the first to submit a cleanup and earn DCU!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((user) => {
              const isCurrentUser = address && user.address.toLowerCase() === address.toLowerCase()
              return (
                <div
                  key={user.address}
                  className={`group rounded-xl border ${
                    isCurrentUser
                      ? 'border-brand-green/50 bg-brand-green/10'
                      : 'border-border bg-card'
                  } p-4 hover:border-brand-green/50 transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`font-bebas text-2xl ${getRankColor(user.rank)}`}>
                        {getRankIcon(user.rank)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bebas text-lg text-foreground">
                            {user.address.slice(0, 6)}...{user.address.slice(-4)}
                          </p>
                          {isCurrentUser && (
                            <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-xs font-bebas text-brand-green">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {user.country && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{user.country}</span>
                            </div>
                          )}
                          <span>{user.cleanups} cleanups</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bebas text-2xl text-brand-green">
                        {user.totalDCU.toFixed(2)} DCU
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-center">
          <Button
            onClick={loadLeaderboard}
            disabled={loading}
            variant="outline"
            className="gap-2 border-brand-green/30 font-bebas tracking-wider text-brand-green hover:bg-brand-green/10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                LOADING...
              </>
            ) : (
              'REFRESH'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

