/**
 * Submission IDs hidden from verifier UI and public impact APIs.
 * On-chain records are unchanged - this is an off-chain display filter only.
 *
 * Default IDs 1, 2, 4 are Celo mainnet-only. Robinhood / Base keep every id.
 *
 * Override server-side: IMPACT_EXCLUDED_SUBMISSION_IDS=1,2,4 (use "none" to clear)
 * Client (verifier page) uses DEFAULT_EXCLUDED_SUBMISSION_IDS when env is unavailable.
 */
import { CELO_MAINNET_CHAIN_ID } from '@/lib/blockchain/chain-constants'

export const DEFAULT_EXCLUDED_SUBMISSION_IDS = ['1', '2', '4'] as const

function parseEnvExcluded(): string[] | null {
  if (typeof process === 'undefined') return null
  const raw = process.env.IMPACT_EXCLUDED_SUBMISSION_IDS?.trim()
  if (raw == null || raw === '') return null
  if (raw.toLowerCase() === 'none') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getExcludedSubmissionIds(chainId?: number): string[] {
  if (chainId != null && chainId !== CELO_MAINNET_CHAIN_ID) return []
  const fromEnv = parseEnvExcluded()
  if (fromEnv != null) return fromEnv
  return [...DEFAULT_EXCLUDED_SUBMISSION_IDS]
}

export function isExcludedSubmissionId(id: string | number | bigint, chainId?: number): boolean {
  const key = String(id)
  return getExcludedSubmissionIds(chainId).includes(key)
}

export function filterExcludedSubmissionIds<T>(
  items: T[],
  getId: (item: T) => string | number | bigint,
  chainId?: number
): T[] {
  return items.filter((item) => !isExcludedSubmissionId(getId(item), chainId))
}
