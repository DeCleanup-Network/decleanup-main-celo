'use client'

import { Network, X } from 'lucide-react'
import { BASE_MAINNET_CHAIN_ID, CELO_MAINNET_CHAIN_ID, type SupportedChainId } from '@/lib/blockchain/chain-constants'

type Props = {
  onSelect: (chainId: SupportedChainId) => void
  onDismiss?: () => void
}

export function ExperiencePickerModal({ onSelect, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onDismiss ? (e) => e.target === e.currentTarget && onDismiss() : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="experience-picker-title"
    >
      <div className="relative mx-4 w-full max-w-lg rounded-lg border-2 border-brand-green bg-gray-900 p-6 shadow-2xl">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-brand-green/20 p-3">
            <Network className="h-12 w-12 text-brand-green" />
          </div>
        </div>
        <h2
          id="experience-picker-title"
          className="mb-3 text-center text-xl font-bold uppercase tracking-wide text-white"
        >
          Choose your experience
        </h2>
        <p className="mb-6 text-center text-sm text-gray-300 leading-relaxed">
          Pick a network first. Celo is the full app. Base is the simple cleanup path.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect(CELO_MAINNET_CHAIN_ID)}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-white/10 p-4 hover:border-brand-green hover:bg-gray-800 transition-colors"
          >
            <span className="text-lg font-bold text-white">Celo</span>
            <span className="text-xs text-gray-400 text-center">Full participation and $cDCU</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect(BASE_MAINNET_CHAIN_ID)}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-white/10 p-4 hover:border-brand-green hover:bg-gray-800 transition-colors"
          >
            <span className="text-lg font-bold text-white">Base</span>
            <span className="text-xs text-gray-400 text-center">Simple cleanup path. Earn $bDCU</span>
          </button>
        </div>
      </div>
    </div>
  )
}
