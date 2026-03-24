'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

/**
 * Used only when Web3Auth is disabled. Kept in a separate file so we don't
 * load RainbowKit (and WalletConnect init) when Web3Auth is enabled.
 */
export function RainbowKitConnectButton() {
  return (
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
  )
}
