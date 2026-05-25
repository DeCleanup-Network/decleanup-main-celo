'use client'

import type { Address, Hex } from 'viem'
import { formatEther, isAddress } from 'viem'
import { DEFAULT_SESSION_POLICY } from '@/lib/client-wallet/signing-session'

export type TransactionPreview = {
  valid: boolean
  errors: string[]
  warnings: string[]
  kind: 'native-transfer' | 'contract-call' | 'invalid'
  summary: string
  to: Address | null
  valueWei: bigint
  valueFormatted: string
  data: Hex
  functionSelector: string | null
  dataLength: number
  sessionAllowed: boolean
  sessionNotes: string[]
}

function getFunctionSelector(data: Hex): string | null {
  if (!data || data === '0x' || data.length < 10) return null
  return data.slice(0, 10)
}

export function buildTransactionPreview(params: {
  to: string
  value: string
  data: string
}): TransactionPreview {
  const errors: string[] = []
  const warnings: string[] = []
  const sessionNotes: string[] = []

  if (!isAddress(params.to)) {
    return {
      valid: false,
      errors: ['Invalid recipient address.'],
      warnings: [],
      kind: 'invalid',
      summary: 'Cannot preview — invalid address.',
      to: null,
      valueWei: 0n,
      valueFormatted: '0',
      data: '0x',
      functionSelector: null,
      dataLength: 0,
      sessionAllowed: false,
      sessionNotes: [],
    }
  }

  let valueWei = 0n
  try {
    valueWei = BigInt(params.value || '0')
  } catch {
    errors.push('Value must be a valid integer (wei).')
  }

  let data: Hex = '0x'
  const rawData = params.data?.trim() || '0x'
  if (rawData.length > 2 && !/^0x[0-9a-fA-F]*$/.test(rawData)) {
    errors.push('Calldata must be hex (0x…).')
  } else {
    data = (rawData.length > 2 ? rawData : '0x') as Hex
  }

  const isTransfer = data === '0x' || data.length <= 2
  const kind = isTransfer ? 'native-transfer' : 'contract-call'
  const selector = getFunctionSelector(data)

  if (kind === 'contract-call') {
    warnings.push('Contract call detected — signing session only allows plain CELO transfers.')
    sessionNotes.push('End session and use full unlock for governance or Safe App interactions.')
  }

  if (valueWei > DEFAULT_SESSION_POLICY.maxValuePerTxWei) {
    sessionNotes.push(
      `Amount exceeds session cap (${formatEther(DEFAULT_SESSION_POLICY.maxValuePerTxWei)} CELO per tx).`
    )
  }

  const sessionAllowed =
    errors.length === 0 &&
    (kind === 'native-transfer' || !DEFAULT_SESSION_POLICY.transfersOnly) &&
    valueWei <= DEFAULT_SESSION_POLICY.maxValuePerTxWei

  const valueFormatted = formatEther(valueWei)
  const summary =
    kind === 'native-transfer'
      ? `Send ${valueFormatted} CELO to ${params.to.slice(0, 6)}…${params.to.slice(-4)}`
      : `Contract call to ${params.to.slice(0, 6)}…${params.to.slice(-4)}${selector ? ` (${selector})` : ''} · ${valueFormatted} CELO`

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    kind,
    summary,
    to: params.to as Address,
    valueWei,
    valueFormatted,
    data,
    functionSelector: selector,
    dataLength: Math.max(0, data.length - 2) / 2,
    sessionAllowed,
    sessionNotes,
  }
}
