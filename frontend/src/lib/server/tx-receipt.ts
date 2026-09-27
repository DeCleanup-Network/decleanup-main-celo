import 'server-only'
import type { PublicClient, TransactionReceipt } from 'viem'

/**
 * Receipt lookup that tolerates RPC lag and load-balanced nodes (forno can briefly return
 * "receipt not found" for a mined tx). Returns null if still missing after all attempts.
 */
export async function getReceiptWithRetry(
  client: Pick<PublicClient, 'getTransactionReceipt'>,
  hash: `0x${string}`,
  attempts = 5,
  delayMs = 1_500
): Promise<TransactionReceipt | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await client.getTransactionReceipt({ hash })
    } catch {
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return null
}
