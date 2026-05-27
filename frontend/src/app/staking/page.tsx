'use client'

import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/layout/BackButton'
import { TrendingUp, ArrowDownUp, Gift, Clock, AlertTriangle } from 'lucide-react'

export default function StakingPage() {
  // Mock data
  const mockData = {
    totalStaked: '1,250.00',
    rewardsEarned: '125.50',
    apr: '8.5%',
    lockPeriod: '30 days',
    balance: '2,000.00',
    transactions: [
      { date: '2026-01-08', action: 'Stake', amount: '500.00 DCU', status: 'Completed' },
      { date: '2026-01-07', action: 'Claim Rewards', amount: '42.50 DCU', status: 'Completed' },
      { date: '2026-01-06', action: 'Unstake', amount: '200.00 DCU', status: 'Pending' },
      { date: '2026-01-05', action: 'Stake', amount: '750.00 DCU', status: 'Completed' },
    ]
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-20">
      <div className="mx-auto max-w-2xl">
        <BackButton href="/" />

        <div className="mb-6 text-center">
          <h1 className="mb-2 text-4xl font-bold uppercase tracking-wide text-white">
            Staking
          </h1>
          <p className="text-sm text-gray-400">
            Stake your DCU tokens to earn rewards and participate in governance
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-semibold text-yellow-400">
                🚀 Coming Soon - Mainnet Launch Required
              </h3>
              <p className="text-sm text-gray-300">
                The staking functionality will be available after the contracts are deployed to Celo Mainnet.
                This page shows a preview of the features that will be enabled once staking goes live.
              </p>
            </div>
          </div>
        </div>



        {/* Staking Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-green" />
              <span className="text-sm font-medium text-gray-400">Total Staked</span>
            </div>
            <p className="text-2xl font-bold text-white">{mockData.totalStaked}</p>
            <p className="text-xs text-gray-400">DCU</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Gift className="h-4 w-4 text-brand-yellow" />
              <span className="text-sm font-medium text-gray-400">Rewards Earned</span>
            </div>
            <p className="text-2xl font-bold text-white">{mockData.rewardsEarned}</p>
            <p className="text-xs text-gray-400">DCU</p>
          </div>
        </div>

        {/* Staking Actions */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Stake DCU Tokens</h3>

          <div className="space-y-4">
            {/* APR Info */}
            <div className="flex items-center justify-between rounded-lg bg-gray-800 p-3">
              <span className="text-sm text-gray-300">Current APR</span>
              <span className="text-lg font-bold text-brand-green">{mockData.apr}</span>
            </div>

            {/* Lock Period */}
            <div className="flex items-center justify-between rounded-lg bg-gray-800 p-3">
              <span className="text-sm text-gray-300">Lock Period</span>
              <span className="text-sm text-gray-400">{mockData.lockPeriod}</span>
            </div>

            {/* Amount Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Amount to Stake
              </label>
              <input
                type="number"
                placeholder="0.0"
                disabled
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 opacity-50 cursor-not-allowed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button disabled className="flex-1 bg-gray-700 text-gray-400 cursor-not-allowed">
                <TrendingUp className="mr-2 h-4 w-4" />
                Stake
              </Button>
              <Button disabled variant="outline" className="flex-1 border-gray-700 text-gray-400 cursor-not-allowed">
                <ArrowDownUp className="mr-2 h-4 w-4" />
                Unstake
              </Button>
              <Button disabled className="flex-1 bg-gray-700 text-gray-400 cursor-not-allowed">
                <Gift className="mr-2 h-4 w-4" />
                Claim Rewards
              </Button>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Recent Transactions</h3>

          <div className="space-y-3">
            {mockData.transactions.map((tx, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    tx.status === 'Completed' ? 'bg-brand-green' :
                    tx.status === 'Pending' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{tx.action}</p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{tx.amount}</p>
                  <p className={`text-xs ${
                    tx.status === 'Completed' ? 'text-brand-green' :
                    tx.status === 'Pending' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 rounded-lg border border-brand-green/50 bg-brand-green/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 flex-shrink-0 text-brand-green mt-0.5" />
            <div className="flex-1">
              <h4 className="mb-1 text-sm font-semibold text-brand-green">
                Staking Benefits
              </h4>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Earn rewards on staked DCU tokens</li>
                <li>• Participate in community governance</li>
                <li>• Help secure the DeCleanup Network ecosystem</li>
                <li>• Flexible staking periods and amounts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}