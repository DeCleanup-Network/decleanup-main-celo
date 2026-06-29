/**
 * Submission IDs hidden from verifier UI and public impact APIs.
 * On-chain records are unchanged — this is an off-chain display filter only.
 *
 * Override server-side: IMPACT_EXCLUDED_SUBMISSION_IDS=1,2,4 (use "none" to clear)
 * Client (verifier page) uses DEFAULT_EXCLUDED_SUBMISSION_IDS when env is unavailable.
 */
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

export function getExcludedSubmissionIds(): string[] {
  const fromEnv = parseEnvExcluded()
  if (fromEnv != null) return fromEnv
  return [...DEFAULT_EXCLUDED_SUBMISSION_IDS]
}

export function isExcludedSubmissionId(id: string | number | bigint): boolean {
  const key = String(id)
  return getExcludedSubmissionIds().includes(key)
}

export function filterExcludedSubmissionIds<T>(
  items: T[],
  getId: (item: T) => string | number | bigint
): T[] {
  return items.filter((item) => !isExcludedSubmissionId(getId(item)))
}
