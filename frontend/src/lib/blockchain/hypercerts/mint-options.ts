import type { Address } from 'viem'
import type { GaslessClient, EmbeddedEoaWriteFn } from '@/lib/blockchain/contracts'

/** Mint + eligibility options for embedded (Google/email) and external wallets. */
export type MintHypercertOptions = {
  /** Pimlico smart account — sponsors gas; mint recipient stays the EOA. */
  gaslessClient?: GaslessClient
  /** Embedded EOA pays gas directly when paymaster is unavailable. */
  embeddedEoaWrite?: EmbeddedEoaWriteFn
  /**
   * On-chain cleanup owner for eligibility rebuilds (Safe for embedded users).
   * Hypercert NFT + Supabase `requester` always use the EOA (`userAddress`).
   */
  submissionOwnerAddress?: Address
}
