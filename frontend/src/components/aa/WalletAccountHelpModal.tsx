'use client'

import { Button } from '@/components/ui/button'
import { WalletHelpTopic } from '@/components/aa/WalletHelpTopic'
import { REQUIRED_RPC_URL, REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'
import type { Address } from 'viem'

type Props = {
  open: boolean
  onClose: () => void
  smartAccountAddress: Address
  eoaAddress: Address
  chainId: number
  chainLabel: string
}

export function WalletAccountHelpModal({
  open,
  onClose,
  smartAccountAddress,
  eoaAddress,
  chainId,
  chainLabel,
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
            Your DeCleanup Rewards wallet address on the blockchain — like a mailbox for rewards. Gas fees can be covered
            for you when sponsorship is on.
            <span className="mt-2 block font-mono text-[10px] text-gray-500">
              Smart account (Safe): {smartAccountAddress}
            </span>
          </WalletHelpTopic>

          <WalletHelpTopic label="Signing key">
            Your key never leaves this device — only you can sign. It authorizes actions for your wallet
            address after you unlock.
            <span className="mt-2 block font-mono text-[10px] text-gray-500">
              EOA: {eoaAddress}
            </span>
          </WalletHelpTopic>

          <WalletHelpTopic label="Gas sponsorship">
            Transaction fees on Celo are small. When sponsorship is on, the DeCleanup Rewards app can pay them so you
            don&apos;t need CELO in your wallet for routine actions.
          </WalletHelpTopic>

          <WalletHelpTopic label="ERC-4337">
            A technical standard that makes your wallet smarter — it enables gas sponsorship and smoother
            signing without a traditional seed phrase in the app.
          </WalletHelpTopic>

          <WalletHelpTopic label={`${chainLabel} / network`}>
            {chainLabel} is the blockchain DeCleanup Rewards uses — fast and low-cost. Chain ID is an internal network
            number wallets need when adding the network manually.
            <span className="mt-1 block text-gray-500">Chain ID: {chainId}</span>
          </WalletHelpTopic>

          <WalletHelpTopic label="Sign-in sync">
            Google or email sign-in loads your encrypted wallet to each device. You still enter your{' '}
            {WALLET_PASSKEY_LOWER} to unlock it.
          </WalletHelpTopic>
        </div>

        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-[11px] text-gray-500">
          <p className="font-medium text-gray-400">Add Celo in MetaMask</p>
          <p className="mt-1">
            RPC: <code className="text-gray-300">{celoRpc}</code> · Chain ID:{' '}
            <code className="text-gray-300">{chainId}</code>
          </p>
        </div>

        <Button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-brand-green font-semibold !text-black hover:bg-brand-green/90"
        >
          Got it
        </Button>
      </div>
    </div>
  )
}

function chainLabelFromId(chainId: number): string {
  if (chainId === 42220) return 'Celo'
  if (chainId === 11142220) return 'Celo Sepolia'
  return `Chain ${chainId}`
}

export { chainLabelFromId }
