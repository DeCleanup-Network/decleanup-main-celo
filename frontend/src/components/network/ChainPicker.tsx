'use client'

import { useState, useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { X, Network } from 'lucide-react'
import { 
  CHAIN_CONFIGS, 
  CELO_MAINNET_CHAIN_ID, 
  BASE_MAINNET_CHAIN_ID, 
  SupportedChainId 
} from '@/lib/blockchain/chain-constants'

const CHAIN_PREFERENCE_KEY = 'decleanup-chain-id'

export function ChainPicker() {
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    setMounted(true)
    const pref = localStorage.getItem(CHAIN_PREFERENCE_KEY)
    if (!pref) {
      setShowModal(true)
    }
  }, [])

  const handleSelect = (selectedChainId: SupportedChainId) => {
    localStorage.setItem(CHAIN_PREFERENCE_KEY, String(selectedChainId))
    setShowModal(false)
    
    try {
      switchChain({ chainId: selectedChainId })
    } catch (e) {
      console.error('Failed to switch chain in wallet', e)
    }
    
    window.location.reload()
  }

  if (!mounted) return null

  const currentConfig = CHAIN_CONFIGS[chainId as SupportedChainId]
  const currentName = currentConfig?.name || 'Select Network'

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <Network className="h-4 w-4 text-brand-green" />
        <span className="hidden sm:inline">{currentName}</span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="relative mx-4 w-full max-w-lg rounded-lg border-2 border-brand-green bg-gray-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-brand-green/20 p-3">
                <Network className="h-12 w-12 text-brand-green" />
              </div>
            </div>
            <h2 className="mb-3 text-center text-xl font-bold uppercase tracking-wide text-white">
              Choose your experience
            </h2>
            <p className="mb-6 text-center text-sm text-gray-300 leading-relaxed">
              Select the network you want to use. You can change this later.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                onClick={() => handleSelect(CELO_MAINNET_CHAIN_ID)}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-white/10 p-4 hover:border-brand-green hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg font-bold text-white">Celo</span>
                <span className="text-xs text-gray-400 text-center">Full participation & Governance</span>
              </button>
              <button
                onClick={() => handleSelect(BASE_MAINNET_CHAIN_ID)}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-white/10 p-4 hover:border-brand-green hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg font-bold text-white">Base</span>
                <span className="text-xs text-gray-400 text-center">Simple cleanup & earn $bDCU</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}