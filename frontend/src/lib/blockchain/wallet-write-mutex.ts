/**
 * Global mutex for all wallet write operations (writeContract + switchChain).
 *
 * WalletConnect on iOS queues requests in the order they arrive. If two writeContract
 * calls (or a switchChain + writeContract) fire concurrently, MetaMask surfaces them
 * out of order or drops the second one entirely. This module serializes every wallet
 * write across the whole app so only one is in-flight at a time.
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
import { writeContract } from '@wagmi/core'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'

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
  return enqueue(() => writeContract(config, params as WriteContractParams))
}

/**
 * Serialized chain switch — drop-in replacement for switchToRequiredChain.
 * Prevents a chain switch from overlapping with an in-flight tx request.
 */
export function lockedSwitchToRequiredChain(config: Config): Promise<boolean> {
  return enqueue(() => switchToRequiredChain(config))
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
      return await writeContract(config, params as WriteContractParams)
    } finally {
      _busy = false
    }
  })
}
