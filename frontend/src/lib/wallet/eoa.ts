import 'server-only'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/** @deprecated Server no longer generates EOAs. Use client-wallet/createWallet.ts */
export function eoaFromPrivateKey(privateKeyHex: Hex) {
  return privateKeyToAccount(privateKeyHex)
}
