'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { AddressCopyIconButton } from './AddressCopyIconButton'

/**
 * Used only when Web3Auth is disabled. Kept in a separate file so we don't
 * load RainbowKit (and WalletConnect init) when Web3Auth is enabled.
 */
export function RainbowKitConnectButton() {
  const { address, isConnected } = useAccount()

  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      {isConnected && address && <AddressCopyIconButton address={address} />}
      <div className="min-w-0 shrink">
        <ConnectButton
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
          chainStatus={{
            smallScreen: 'icon',
            largeScreen: 'full',
          }}
          showBalance={{
            smallScreen: false,
            largeScreen: true,
          }}
        />
      </div>
    </div>
  )
}
