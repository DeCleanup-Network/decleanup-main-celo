import type { Address, Hex } from 'viem'

/** Ask the server to mint/sync $rDCU so the connected wallet does not sign a second tx. */
export async function requestRobinhoodRdcuSettle(params: {
  submissionId?: bigint | string
  user?: Address | string
}): Promise<Hex | undefined> {
  const submissionId =
    params.submissionId != null ? String(params.submissionId) : undefined
  const user = params.user ? String(params.user) : undefined
  if (!submissionId && !user) return undefined

  const res = await fetch('/api/rdcu/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, user }),
  })
  if (res.status === 503) return undefined
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not mint $rDCU')
  }
  const data = (await res.json().catch(() => ({}))) as { hashes?: string[] }
  const hash = data.hashes?.find((h) => typeof h === 'string' && h.startsWith('0x'))
  return hash as Hex | undefined
}
