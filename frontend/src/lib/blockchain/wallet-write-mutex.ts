/**
 * Global mutex for wallet RPC requests (writeContract, switchChain, signMessage).
 *
 * WalletConnect on iOS queues requests in the order they arrive. If two requests
 * fire concurrently, MetaMask surfaces them out of order or drops the second one.
 * This module serializes every wallet op across the app so only one is in-flight.
 *
 * Usage:
 *   import { lockedWriteContract, lockedSwitchToRequiredChain } from '@/lib/blockchain/wallet-write-mutex'
 *
 *   // replace: await writeContract(getConfig(), params)
 *   // with:    await lockedWriteContract(getConfig(), params)
 *
 *   // replace: await switchToRequiredChain(config)
 *   // with:    await lockedSwitchToRequiredChain(config)
 *
 * Gasless paths (gaslessClient.sendTransaction) go through the AA bundler,
 * not WalletConnect — they don't need this mutex.
 */

import type { Config } from 'wagmi'
import type { Hex } from 'viem'
import { getAccount, reconnect, signMessage, writeContract } from '@wagmi/core'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'
import { waitForWalletConnectChainReady } from '@/lib/blockchain/wait-for-wc-chain-ready'
import { waitForUserReturnFromWallet } from '@/lib/blockchain/wait-for-wallet-return'

/** Wagmi writeContract params (strict). */
type WriteContractParams = Parameters<typeof writeContract>[1]

/**
 * Input accepted by lockedWriteContract — widened so payable txs (value) and
 * const ABIs type-check at call sites; cast to WriteContractParams at invoke.
 */
export type LockedWriteContractInput = WriteContractParams extends infer P
  ? P extends WriteContractParams
    ? P | (Omit<WriteContractParams, 'value'> & { value?: bigint })
    : never
  : never

// Module-level promise chain — all wallet ops queue behind this.
let _queue: Promise<unknown> = Promise.resolve()

/**
 * Enqueue a wallet operation. The operation runs only after all previously
 * enqueued operations have settled (resolved or rejected).
 */
function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const next = _queue.then(op)
  // Keep the queue moving even if this op throws — callers get the real error,
  // but the next enqueued op still runs.
  _queue = next.catch(() => {})
  return next
}

/**
 * Serialized writeContract — drop-in replacement for @wagmi/core writeContract.
 * Waits for any in-flight wallet op to finish before sending this tx.
 */
export function lockedWriteContract(
  config: Config,
  params: LockedWriteContractInput
): Promise<Hex> {
  return enqueue(async () => {
    _busy = true
    try {
      await prepareMobileWalletWrite(config)
      return await writeContract(config, params as WriteContractParams)
    } finally {
      _busy = false
    }
  })
}

/**
 * Serialized chain switch — drop-in replacement for switchToRequiredChain.
 * Prevents a chain switch from overlapping with an in-flight tx request.
 */
export function lockedSwitchToRequiredChain(config: Config): Promise<boolean> {
  return enqueue(() => switchToRequiredChain(config))
}

/**
 * Warm WalletConnect / mobile session before personal_sign or eth_sendTransaction.
 * Call synchronously at the start of a click handler when possible.
 */
export async function prepareWalletConnectSession(config: Config): Promise<void> {
  const account = getAccount(config)
  if (!account.isConnected) return
  const needsPrep =
    account.connector?.id === 'walletConnect' || isMobileBrowser()
  if (!needsPrep) return
  await reconnect(config).catch(() => {})
}

async function prepareMobileWalletWrite(config: Config): Promise<void> {
  const account = getAccount(config)
  if (!account.isConnected) return
  const needsPrep =
    account.connector?.id === 'walletConnect' || isMobileBrowser()
  if (!needsPrep) return

  await waitForUserReturnFromWallet()
  await prepareWalletConnectSession(config)
  await waitForWalletConnectChainReady(config, { skipVisibilityWait: true })
  if (account.chainId != null && account.chainId !== REQUIRED_CHAIN_ID) {
    throw new Error(
      'Wallet is not on Celo yet. Switch in your wallet app, return to the browser, then try again.'
    )
  }
}

/**
 * Serialized personal_sign — use instead of useSignMessage().signMessageAsync on WC/mobile.
 */
export function lockedSignMessage(
  config: Config,
  params: Parameters<typeof signMessage>[1]
): Promise<Hex> {
  return enqueue(async () => {
    await prepareWalletConnectSession(config)
    return signMessage(config, params)
  })
}

/**
 * Returns true if there is currently a wallet operation in progress.
 * Useful for disabling all tx buttons globally while a write is pending.
 */
let _busy = false

export function isWalletOpInProgress(): boolean {
  return _busy
}

// Internal version that tracks busy state — used by writeContractViaWalletProvider
// which already handles settle/switch logic and just needs the queue.
export function lockedWriteContractRaw(
  config: Config,
  params: LockedWriteContractInput
): Promise<Hex> {
  return enqueue(async () => {
    _busy = true
    try {
      await prepareMobileWalletWrite(config)
      return await writeContract(config, params as WriteContractParams)
    } finally {
      _busy = false
    }
  })
}
