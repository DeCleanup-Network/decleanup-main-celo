'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
} from '@/lib/blockchain/chain-constants'
import { AlertModal } from '@/components/ui/alert-modal'
import { isWeb3AuthEnabled } from '@/lib/web3auth/config'

const NATIVE_SYMBOL = 'CELO'

function chainIdToHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}` as const
}

const MANUAL_INSTRUCTIONS = (
  requiredChainName: string,
  requiredChainId: number,
  requiredRpcUrl: string,
  requiredBlockExplorer: string
) =>
  `Please switch to ${requiredChainName} manually in your wallet:\n\n` +
      `1. Open your wallet's network dropdown\n` +
      `2. Add network or "Add a network manually" if needed\n` +
      `3. Use:\n` +
      `   - Network Name: ${requiredChainName}\n` +
      `   - RPC URL: ${requiredRpcUrl}\n` +
      `   - Chain ID: ${requiredChainId}\n` +
      `   - Currency: ${NATIVE_SYMBOL}\n` +
      `   - Block Explorer: ${requiredBlockExplorer}\n` +
      `4. Save and switch to this network`

/** Wrong-network banner for Web3Auth: chain from provider (wagmi chain id is stale after login). */
function NetworkCheckerWeb3Auth() {
  const { isConnected } = useAccount()
  const chainId = useResolvedChainId()
  const [showWarning, setShowWarning] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'useResolvedChainId result:',
        chainId,
        'REQUIRED:',
        REQUIRED_CHAIN_ID,
        'match:',
        chainId === REQUIRED_CHAIN_ID
      )
    }
    if (isConnected && chainId != null && chainId !== REQUIRED_CHAIN_ID) setShowWarning(true)
    else setShowWarning(false)
  }, [isConnected, chainId])

  return (
    <NetworkCheckerUI
      embedWalletMode
      isConnected={!!isConnected}
      chainId={chainId}
      showWarning={showWarning}
      onDismiss={() => setShowWarning(false)}
    />
  )
}

function NetworkCheckerWagmi() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const [showWarning, setShowWarning] = useState(false)
  const [manualSwitchModal, setManualSwitchModal] = useState<string | null>(null)

  useEffect(() => {
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID) setShowWarning(true)
    else setShowWarning(false)
  }, [isConnected, chainId])

  const handleSwitchNetwork = async () => {
    const hexChainId = chainIdToHex(REQUIRED_CHAIN_ID)
    setManualSwitchModal(null)

    const tryProviderSwitch = async (): Promise<boolean> => {
      if (!walletClient?.request) return false
      try {
        await (walletClient as any).request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        })
        return true
      } catch (e: any) {
        if (e?.code === 4902) {
          await (walletClient as any).request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: REQUIRED_CHAIN_NAME,
                rpcUrls: [REQUIRED_RPC_URL],
                blockExplorerUrls: [REQUIRED_BLOCK_EXPLORER_URL].filter(Boolean),
                nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
              },
            ],
          })
          await (walletClient as any).request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }],
          })
          return true
        }
        throw e
      }
    }

    try {
      try {
        await switchChain({ chainId: REQUIRED_CHAIN_ID })
      } catch (wagmiError) {
        const ok = await tryProviderSwitch()
        if (!ok) throw wagmiError
      }
    } catch (error) {
      console.error('Failed to switch network:', error)
      setManualSwitchModal(
        MANUAL_INSTRUCTIONS(REQUIRED_CHAIN_NAME, REQUIRED_CHAIN_ID, REQUIRED_RPC_URL, REQUIRED_BLOCK_EXPLORER_URL)
      )
    }
  }

  return (
    <NetworkCheckerUI
      isConnected={!!isConnected}
      chainId={chainId}
      showWarning={showWarning}
      isPending={isPending}
      onSwitch={handleSwitchNetwork}
      onDismiss={() => setShowWarning(false)}
      manualSwitchModal={manualSwitchModal}
      setManualSwitchModal={setManualSwitchModal}
    />
  )
}

type NetworkCheckerUIProps = {
  isConnected: boolean
  chainId: number | undefined
  showWarning: boolean
  onDismiss: () => void
} & (
  | {
      embedWalletMode: true
    }
  | {
      embedWalletMode?: false
      isPending: boolean
      onSwitch: () => Promise<void>
      manualSwitchModal: string | null
      setManualSwitchModal: (v: string | null) => void
    }
)

function NetworkCheckerUI(props: NetworkCheckerUIProps) {
  const {
    isConnected,
    chainId,
    showWarning,
    onDismiss,
  } = props
  const embedWalletMode = 'embedWalletMode' in props && props.embedWalletMode === true
  const isPending = !embedWalletMode ? props.isPending : false
  const onSwitch = !embedWalletMode ? props.onSwitch : undefined
  const manualSwitchModal = !embedWalletMode ? props.manualSwitchModal : null
  const setManualSwitchModal = !embedWalletMode ? props.setManualSwitchModal : undefined

  if (!isConnected || !showWarning || chainId === undefined || chainId === REQUIRED_CHAIN_ID) {
    return null
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-4xl px-4 sm:top-20">
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div className="flex-1">
            <h3 className="mb-1 font-semibold text-yellow-400">Wrong Network</h3>
            <p className="mb-3 text-sm text-gray-300">
              {embedWalletMode
                ? "You're on the wrong network. With email/Google login there's no wallet menu. Use Reset session & reconnect to log in on Celo Sepolia Testnet."
                : `You're connected to the wrong network. Please switch to ${REQUIRED_CHAIN_NAME} to use this app.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {embedWalletMode ? (
                <>
                  <Button size="sm" className="bg-brand-green text-black hover:bg-brand-green/90" asChild>
                    <Link href="/reset-wallet-session">Reset session & reconnect</Link>
                  </Button>
                  <Button onClick={onDismiss} variant="outline" size="sm" className="border-gray-600 text-gray-300">
                    Dismiss
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={onSwitch}
                    disabled={isPending}
                    size="sm"
                    className="bg-brand-green text-black hover:bg-brand-green/90"
                  >
                    {isPending ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
                  </Button>
                  <Button onClick={onDismiss} variant="outline" size="sm" className="border-gray-600 text-gray-300">
                    Dismiss
                  </Button>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Current network: Chain ID {chainId} | Required: Chain ID {REQUIRED_CHAIN_ID}
            </p>
          </div>
        </div>
      </div>

      {!embedWalletMode && manualSwitchModal && setManualSwitchModal && (
        <AlertModal
          isOpen
          onClose={() => setManualSwitchModal(null)}
          title="Switch network manually"
          message={manualSwitchModal}
          variant="info"
        />
      )}
    </div>
  )
}

export function NetworkChecker() {
  if (isWeb3AuthEnabled) return <NetworkCheckerWeb3Auth />
  return <NetworkCheckerWagmi />
}

