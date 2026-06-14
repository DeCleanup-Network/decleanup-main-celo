'use client'

import Link from 'next/link'

export function WalletOsRoadmap() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Wallet OS roadmap</h2>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-300">Governance (ESX)</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Extend signing sessions for Snapshot, Tally, and Safe Apps — vote without exporting keys.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Snapshot', 'Tally', 'Safe Apps'].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-300">WalletConnect v2 bridge</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Connect this embedded wallet to external dApps without MetaMask or key export.
          </p>
          <span className="inline-block mt-2 rounded-full border border-brand-green/30 px-2 py-0.5 text-[10px] text-brand-green">
            Planned
          </span>
        </div>
      </div>

      <Link href="/guide#embedded-wallet" className="text-xs text-brand-green underline">
        Wallet security guide
      </Link>
    </div>
  )
}
