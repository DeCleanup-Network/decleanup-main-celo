'use client'

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Address, Hex } from 'viem'

export type ClientGeneratedWallet = {
  privateKey: Hex
  address: Address
}

/**
 * Generate a new EOA entirely in the browser. Raw private key must never be sent to the server.
 */
export function createClientWallet(): ClientGeneratedWallet {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return { privateKey, address: account.address }
}
