'use client'

import { useState, useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { Network } from 'lucide-react'
import { CHAIN_CONFIGS, REQUIRED_CHAIN_ID, type SupportedChainId } from '@/lib/blockchain/chain-constants'
import { readChainPreference, writeChainPreference } from '@/lib/blockchain/chain-preference'
import { ExperiencePickerModal } from '@/components/network/ExperiencePickerModal'

export function ChainPicker() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  return <ChainPickerReady />
}

function ChainPickerReady() {
  const [showModal, setShowModal] = useState(false)
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const handleSelect = (selectedChainId: SupportedChainId) => {
    writeChainPreference(selectedChainId)
    setShowModal(false)

    try {
      switchChain({ chainId: selectedChainId })
    } catch (e) {
      console.error('Failed to switch chain in wallet', e)
    }

    window.location.reload()
  }

  const preferred = readChainPreference() ?? REQUIRED_CHAIN_ID
  const currentConfig = CHAIN_CONFIGS[preferred] ?? CHAIN_CONFIGS[chainId as SupportedChainId]
  const currentName = currentConfig?.name || 'Select Network'

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <Network className="h-4 w-4 text-brand-green" />
        <span className="hidden sm:inline">{currentName}</span>
      </button>

      {showModal ? (
        <ExperiencePickerModal onSelect={handleSelect} onDismiss={() => setShowModal(false)} />
      ) : null}
    </>
  )
}
