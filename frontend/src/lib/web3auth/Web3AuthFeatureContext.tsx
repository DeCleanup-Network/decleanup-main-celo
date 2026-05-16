'use client'

import { createContext, useContext } from 'react'

export type Web3AuthFeatureState = {
  /** False when signer feature-access returns 403 (typical: Base plan on Sapphire Mainnet). */
  socialLoginEnabled: boolean
  walletServicesForbidden: boolean
  probeComplete: boolean
}

const defaultState: Web3AuthFeatureState = {
  socialLoginEnabled: true,
  walletServicesForbidden: false,
  probeComplete: false,
}

export const Web3AuthFeatureContext = createContext<Web3AuthFeatureState>(defaultState)

export function useWeb3AuthFeature(): Web3AuthFeatureState {
  return useContext(Web3AuthFeatureContext)
}
