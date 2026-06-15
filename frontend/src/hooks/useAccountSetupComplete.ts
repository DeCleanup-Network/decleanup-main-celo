'use client'

import { useSession } from 'next-auth/react'
import { useWallet } from '@/providers/WalletProvider'
import type { WalletPhase } from '@/providers/WalletProvider'

export function useAccountSetupComplete(phase: WalletPhase) {
  const { needsSigningPassword } = useWallet()

  const passkeyReady =
    phase !== 'pending-password' && phase !== 'no-wallet' && phase !== 'loading' && !needsSigningPassword

  const setupComplete = passkeyReady

  return {
    setupComplete,
    passkeyReady,
    biometricsReady: true,
  }
}
