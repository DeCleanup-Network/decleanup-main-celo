import { isAddress, type Address } from 'viem'

export type PortfolioEndorsement = {
  id: string
  portfolioAddress: string
  endorserAddress: string
  endorserName: string
  endorserOrg: string
  statement: string
  createdAt: string
}

export const ENDORSEMENT_LIMITS = {
  endorserName: 120,
  endorserOrg: 120,
  statement: 420,
} as const

export function buildEndorsementSignMessage(params: {
  portfolioAddress: Address
  endorserAddress: Address
  endorserName: string
  endorserOrg: string
  statement: string
  timestamp: number
}): string {
  return [
    'DeCleanup Impact Portfolio Endorsement',
    `Portfolio: ${params.portfolioAddress.toLowerCase()}`,
    `Endorser: ${params.endorserAddress.toLowerCase()}`,
    `Name: ${params.endorserName.trim()}`,
    `Organization: ${params.endorserOrg.trim()}`,
    `Statement: ${params.statement.trim()}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n')
}

export function sanitizeEndorsementInput(input: {
  endorserName?: string
  endorserOrg?: string
  statement?: string
}): { endorserName: string; endorserOrg: string; statement: string } {
  const clamp = (v: unknown, max: number) =>
    (typeof v === 'string' ? v.trim() : '').slice(0, max)
  return {
    endorserName: clamp(input.endorserName, ENDORSEMENT_LIMITS.endorserName),
    endorserOrg: clamp(input.endorserOrg, ENDORSEMENT_LIMITS.endorserOrg),
    statement: clamp(input.statement, ENDORSEMENT_LIMITS.statement),
  }
}

export function isValidEndorsementAddress(value: string): value is Address {
  return isAddress(value)
}
