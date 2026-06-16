'use client'

import { Button } from '@/components/ui/button'
import { WalletHelpTopic } from '@/components/aa/WalletHelpTopic'
import { REQUIRED_RPC_URL, REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'
import type { Address } from 'viem'

type Props = {
  open: boolean
  onClose: () => void
  walletAddress: Address
  chainId: number
  chainLabel: string
  gaslessEnabled?: boolean
}

export function WalletAccountHelpModal({
  open,
  onClose,
  walletAddress,
  chainId,
  chainLabel,
  gaslessEnabled = true,
}: Props) {
  if (!open) return null

  const celoRpc =
    chainId === 42220 ? 'https://forno.celo.org' : REQUIRED_RPC_URL

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-account-help-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="wallet-account-help-title" className="text-lg font-semibold text-white">
            Wallet terms explained
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <WalletHelpTopic label="Your wallet address">
            Your DeCleanup identity on Celo — impact portfolio, rewards, $cDCU airdrops, and{' '}
            <a
              href="https://gardens.fund"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-green hover:underline"
            >
              gardens.fund
            </a>{' '}
            all use this address. It is the same address MetaMask shows after you export your signing
            key.
            <span className="mt-2 block font-mono text-[10px] text-gray-500">{walletAddress}</span>
          </WalletHelpTopic>

          <WalletHelpTopic label="Signing key">
            The private key you export unlocks this address. After you set a 6-digit {WALLET_PASSCODE_LOWER}{' '}
            in the app, routine actions stay gasless when sponsorship is on.
          </WalletHelpTopic>

          <WalletHelpTopic label="Gas sponsorship">
            {gaslessEnabled
              ? 'Celo transaction fees for routine DeCleanup actions are covered by the protocol when sponsorship is on.'
              : 'Gas sponsorship is off for this session. You may need a small CELO balance for transactions.'}
          </WalletHelpTopic>

          <WalletHelpTopic label="ERC-4337">
            Behind the scenes, a smart account executes your transactions so fees can be sponsored. You
            only need to know your wallet address above.
          </WalletHelpTopic>

          <WalletHelpTopic label="Network">
            Chain: {chainLabel} (ID {chainId}). RPC:{' '}
            <span className="font-mono text-[10px] text-gray-500 break-all">{celoRpc}</span>
          </WalletHelpTopic>

          <WalletHelpTopic label="Lost access?">
            Email{' '}
            <a href="mailto:support@decleanup.net" className="text-brand-green hover:underline">
              support@decleanup.net
            </a>{' '}
            from your sign-in email. We can help after identity verification.
          </WalletHelpTopic>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function chainLabelFromId(chainId: number): string {
  if (chainId === 42220) return 'Celo Mainnet'
  if (chainId === 11142220) return 'Celo Sepolia'
  return `Chain ${chainId}`
}
