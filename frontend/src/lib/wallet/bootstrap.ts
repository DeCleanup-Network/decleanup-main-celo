import 'server-only'
import type { Address } from 'viem'
import { findWalletMetadata } from '@/lib/wallet/repository'
import { isPimlicoConfigured } from '@/lib/paymaster/pimlico'

export type WalletBootstrapResult = {
  address: Address | null
  smartAccountAddress: Address | null
  chainId: number | null
  gaslessEnabled: boolean
  hasWallet: boolean
}

/** Read-only metadata — wallet creation happens on the client. */
export async function getWalletBootstrapState(userId: string): Promise<WalletBootstrapResult> {
  const meta = await findWalletMetadata(userId)
  if (!meta) {
    return {
      address: null,
      smartAccountAddress: null,
      chainId: null,
      gaslessEnabled: isPimlicoConfigured(),
      hasWallet: false,
    }
  }
  return {
    address: meta.address,
    smartAccountAddress: meta.smartAccountAddress,
    chainId: meta.chainId,
    gaslessEnabled: isPimlicoConfigured(),
    hasWallet: true,
  }
}
