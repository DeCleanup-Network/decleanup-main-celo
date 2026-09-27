import 'server-only'
import { getAddress, isAddress, isHex, verifyMessage, type Address, type Hex } from 'viem'
import { buildSignedActionMessage } from '@/lib/auth/signed-action-message'

export { buildSignedActionMessage }

const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000

export async function verifySignedAction(opts: {
  address: string
  signature: string
  action: string
  extra: Record<string, string>
  timestamp: number
  maxAgeMs?: number
}): Promise<Address | null> {
  if (!isAddress(opts.address) || !isHex(opts.signature)) return null
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  if (!Number.isFinite(opts.timestamp) || Math.abs(Date.now() - opts.timestamp) > maxAgeMs) {
    return null
  }
  const message = buildSignedActionMessage(opts.action, opts.extra, opts.timestamp)
  const address = getAddress(opts.address) as Address
  const valid = await verifyMessage({
    address,
    message,
    signature: opts.signature as Hex,
  })
  return valid ? address : null
}
