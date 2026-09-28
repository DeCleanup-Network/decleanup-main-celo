'use client'

import { useEffect, useState } from 'react'
import { REQUIRED_CHAIN_ID, type SupportedChainId } from '@/lib/blockchain/chain-constants'
import {
  CHAIN_PREFERENCE_CHANGE_EVENT,
  isBaseExperience,
  isCeloExperience,
  isRobinhoodExperience,
  readChainPreference,
} from '@/lib/blockchain/chain-preference'

function liveExperienceChainId(): SupportedChainId {
  return readChainPreference() ?? REQUIRED_CHAIN_ID
}

/** Live Celo/Base/Robinhood pick after mount. Defaults to env chain until localStorage is read. */
export function useExperienceChain() {
  const [chainId, setChainId] = useState<SupportedChainId>(REQUIRED_CHAIN_ID)

  useEffect(() => {
    const sync = () => setChainId(liveExperienceChainId())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(CHAIN_PREFERENCE_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHAIN_PREFERENCE_CHANGE_EVENT, sync)
    }
  }, [])

  return {
    chainId,
    isBase: isBaseExperience(chainId),
    isCelo: isCeloExperience(chainId),
    isRobinhood: isRobinhoodExperience(chainId),
  }
}

/** Celo-only hubs (impact portfolio, Hypercerts). Hidden until the live pick is known so Robinhood/Base never flash those links. */
export function useShowCeloOnlyHubs() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const sync = () => {
      const id = liveExperienceChainId()
      setShow(isCeloExperience(id) && !isBaseExperience(id) && !isRobinhoodExperience(id))
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(CHAIN_PREFERENCE_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHAIN_PREFERENCE_CHANGE_EVENT, sync)
    }
  }, [])
  return show
}

/** Impact portfolio is Celo-only. Hidden until the live experience is known so Robinhood/Base never flash the link. */
export function useShowImpactPortfolio() {
  return useShowCeloOnlyHubs()
}

/** Hypercerts hub and DCU row are Celo-only. Same mount gate as the impact portfolio link. */
export function useShowHypercertsHub() {
  return useShowCeloOnlyHubs()
}
