/**
 * Adapts a wagmi/viem WalletClient (e.g. from Web3Auth) to a viem Account
 * for permissionless Safe smart accounts.
 *
 * Must use walletClient.signMessage / signTypedData — NOT manual personal_sign
 * with hashMessage(...). The latter double-applies EIP-191 vs what the wallet
 * expects and breaks Safe ERC-4337 UserOp verification (EntryPoint AA24).
 */
import type { Account } from 'viem'
import { toAccount } from 'viem/accounts'
import type { WalletClient } from 'viem'

export function walletClientToAccount(walletClient: WalletClient): Account {
  const address = walletClient.account?.address
  if (!address) throw new Error('WalletClient has no account address')

  // Pass address as `account` so viem infers Sign* parameters (full Account + spread breaks generics).
  const accountParam = address

  return toAccount({
    address,
    signMessage: (args) =>
      walletClient.signMessage({ ...args, account: accountParam }),
    // Spread + account widens generics; runtime shape is still correct for viem.
    signTypedData: (args) =>
      walletClient.signTypedData(
        { ...args, account: accountParam } as Parameters<
          WalletClient['signTypedData']
        >[0]
      ),
    signTransaction: (tx) =>
      walletClient.signTransaction(
        { ...tx, account: accountParam } as Parameters<
          WalletClient['signTransaction']
        >[0]
      ),
  })
}
