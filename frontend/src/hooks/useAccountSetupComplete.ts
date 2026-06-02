'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { isPasskeySupported } from '@/lib/passkey/config-client'
import { isWalletBackupMarkedDownloaded } from '@/lib/client-wallet/account-setup'
import { useWallet } from '@/providers/WalletProvider'
import type { WalletPhase } from '@/providers/WalletProvider'

export function useAccountSetupComplete(phase: WalletPhase) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const { needsSigningPassword, isPasskeyEnabled } = useWallet()
  const [backupDownloaded, setBackupDownloaded] = useState(false)

  useEffect(() => {
    setBackupDownloaded(isWalletBackupMarkedDownloaded(userId))
  }, [userId])

  const passkeyReady =
    phase !== 'pending-password' && phase !== 'no-wallet' && phase !== 'loading' && !needsSigningPassword

  const biometricsRequired = isPasskeySupported()
  const biometricsReady = !biometricsRequired || isPasskeyEnabled

  const setupComplete = passkeyReady && biometricsReady && backupDownloaded

  return {
    setupComplete,
    passkeyReady,
    biometricsReady,
    backupDownloaded,
    refreshBackupFlag: () => setBackupDownloaded(isWalletBackupMarkedDownloaded(userId)),
  }
}
