'use client'

import { useWallet } from '@/providers/WalletProvider'

export type AaWalletState = {
  eoaAddress: string
  smartAccountAddress: string
  chainId: number
  balance: string
  gaslessEnabled: boolean
}

/** Thin adapter over WalletProvider for dashboard components. */
export function useAaWallet() {
  const wallet = useWallet()

  const state: AaWalletState | null =
    wallet.eoaAddress && wallet.smartAccountAddress && wallet.chainId != null
      ? {
          eoaAddress: wallet.eoaAddress,
          smartAccountAddress: wallet.smartAccountAddress,
          chainId: wallet.chainId,
          balance: wallet.balance ?? '0',
          gaslessEnabled: wallet.gaslessEnabled,
        }
      : null

  return {
    wallet: state,
    loading: wallet.phase === 'loading',
    error: wallet.error,
    phase: wallet.phase,
    refresh: wallet.refreshBalance,
    lock: wallet.lock,
  }
}
