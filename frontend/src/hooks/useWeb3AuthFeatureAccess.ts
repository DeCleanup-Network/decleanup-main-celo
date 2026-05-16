'use client'

import { useEffect, useState } from 'react'
import { web3AuthClientId, web3AuthSapphireNetwork } from '@/lib/web3auth/config'
import {
  checkWeb3AuthWalletServicesAccess,
  type Web3AuthFeatureAccessResult,
} from '@/lib/web3auth/feature-access'

/**
 * Pre-flight check for Wallet Services entitlement (403 = dashboard / billing).
 */
export function useWeb3AuthFeatureAccess(): Web3AuthFeatureAccessResult | 'idle' {
  const [status, setStatus] = useState<Web3AuthFeatureAccessResult | 'idle'>('idle')

  useEffect(() => {
    if (!web3AuthClientId) {
      setStatus('error')
      return
    }

    let cancelled = false
    setStatus('idle')

    void checkWeb3AuthWalletServicesAccess({
      clientId: web3AuthClientId,
      network: web3AuthSapphireNetwork,
    }).then((result) => {
      if (!cancelled) setStatus(result)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
