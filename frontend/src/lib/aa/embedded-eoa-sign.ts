'use client'

import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/** personal_sign from the embedded Google/email EOA (no wagmi). */
export async function signMessageWithEmbeddedEoa(
  privateKeyHex: Hex,
  message: string
): Promise<Hex> {
  const account = privateKeyToAccount(privateKeyHex)
  return account.signMessage({ message })
}
