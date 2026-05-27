'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useChainId, useConfig } from 'wagmi'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
} from '@/lib/blockchain/chain-constants'
import { AlertModal } from '@/components/ui/alert-modal'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'
import { MANUAL_SWITCH_INSTRUCTIONS } from '@/lib/blockchain/network-manual-switch'

const isPrivyEnabled = typeof process !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID)

/** Wrong-network banner for embedded wallets: chain from provider (wagmi chain id can be stale after login). */
function NetworkCheckerEmbedded() {
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
  const config = useConfig()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [showWarning, setShowWarning] = useState(false)
  const [manualSwitchModal, setManualSwitchModal] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID) setShowWarning(true)
    else setShowWarning(false)
  }, [isConnected, chainId])

  const handleSwitchNetwork = async () => {
    setManualSwitchModal(null)
    setIsPending(true)
    try {
      const ok = await switchToRequiredChain(config)
      if (!ok) {
        setManualSwitchModal(MANUAL_SWITCH_INSTRUCTIONS)
      }
    } catch (error) {
      console.error('Failed to switch network:', error)
      setManualSwitchModal(MANUAL_SWITCH_INSTRUCTIONS)
    } finally {
      setIsPending(false)
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
                ? `You're on the wrong network. With email/Google login there's no wallet menu. Use Reset session & reconnect to log in on ${REQUIRED_CHAIN_NAME}.`
                : `You're connected to the wrong network. Please switch to ${REQUIRED_CHAIN_NAME} to use this app.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {embedWalletMode ? (
                <>
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
  // AA mode still uses MetaMask for some flows (airdrop, external wallet login) — keep the switch banner.
  if (isPrivyEnabled && !isAaAuthEnabledClient()) return <NetworkCheckerEmbedded />
  return <NetworkCheckerWagmi />
}

