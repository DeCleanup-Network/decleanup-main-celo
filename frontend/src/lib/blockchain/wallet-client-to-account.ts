/**
 * Adapts a wagmi/viem WalletClient (e.g. from Web3Auth) to a viem Account
 * so it can be used as the owner of a permissionless smart account.
 */
import type { Account } from 'viem'
import { toAccount } from 'viem/accounts'
import type { WalletClient } from 'viem'
import { hashMessage } from 'viem'

/**
 * Converts a WalletClient to a viem Account by delegating signing to wallet.request().
 * Required for createSmartAccountClientCeloSepolia(owner) when the signer is Web3Auth (no private key).
 */
export function walletClientToAccount(walletClient: WalletClient): Account {
  const address = walletClient.account?.address
  if (!address) throw new Error('WalletClient has no account address')

  return toAccount({
    address,
    signMessage: async ({ message }) => {
      const hex = typeof message === 'string' ? hashMessage(message) : message.raw
      const sig = await walletClient.request({
        method: 'personal_sign',
        params: [hex, address],
      })
      return sig as `0x${string}`
    },
    signTypedData: async (args) => {
      const { domain, types, primaryType, message } = args
      const sig = await walletClient.request({
        method: 'eth_signTypedData_v4',
        params: [
          address,
          JSON.stringify({
            domain: domain ?? {},
            types: types ?? {},
            primaryType,
            message: message ?? {},
          }),
        ],
      })
      return sig as `0x${string}`
    },
    signTransaction: async (tx) => {
      const signed = await walletClient.request({
        method: 'eth_signTransaction',
        params: [tx as Record<string, unknown>],
      })
      return signed as `0x${string}`
    },
  })
}
