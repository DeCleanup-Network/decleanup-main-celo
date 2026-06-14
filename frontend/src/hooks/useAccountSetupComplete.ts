'use client'

import { useSession } from 'next-auth/react'
import { isPasskeySupported } from '@/lib/passkey/config-client'
import { useWallet } from '@/providers/WalletProvider'
import type { WalletPhase } from '@/providers/WalletProvider'

export function useAccountSetupComplete(phase: WalletPhase) {
  const { needsSigningPassword, isPasskeyEnabled } = useWallet()

  const passkeyReady =
    phase !== 'pending-password' && phase !== 'no-wallet' && phase !== 'loading' && !needsSigningPassword

  const biometricsRequired = isPasskeySupported()
  const biometricsReady = !biometricsRequired || isPasskeyEnabled

  const setupComplete = passkeyReady && biometricsReady

  return {
    setupComplete,
    passkeyReady,
    biometricsReady,
  }
}
