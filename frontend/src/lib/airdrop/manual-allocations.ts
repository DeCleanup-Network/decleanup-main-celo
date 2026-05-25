import type { Address } from 'viem'

export type AirdropAllocation = {
  walletAddress: Address
  amountCdcu: string
  category: string
  label: string
}

/**
 * Temporary manual list until CSV import is ready.
 * Matching is case-insensitive (lowercase keys in map).
 */
export const MANUAL_AIRDROP_ALLOCATIONS: readonly AirdropAllocation[] = [
  {
    walletAddress: '0x7D85fCbB505D48E6176483733b62b51704e0bF95',
    amountCdcu: '50',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xEf0862aE5175dF25E59Db4E9115Fb6987Cf4B779',
    amountCdcu: '250',
    category: 'whitelist',
    label: '$cDCU whitelist',
  },
  {
    walletAddress: '0xCa0349e71C30C888919F4E6B2e40C9550888e805',
    amountCdcu: '250',
    category: 'whitelist',
    label: '$cDCU whitelist',
  },
  {
    walletAddress: '0x447b7830481763001df8e0e3e2e5714d452a37e7',
    amountCdcu: '250',
    category: 'whitelist',
    label: '$cDCU whitelist',
  },
  {
    walletAddress: '0x50418699cB44BfDa9c9afc9B7a0b0d244d8927D2',
    amountCdcu: '200',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0x173D87dfa68aEB0E821C6021f5652B9C3a7556b4',
    amountCdcu: '200',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
] as const

const allocationMap = new Map<string, AirdropAllocation>(
  MANUAL_AIRDROP_ALLOCATIONS.map((row) => [row.walletAddress.toLowerCase(), row])
)

export function getAirdropAllocation(address: string): AirdropAllocation | null {
  return allocationMap.get(address.toLowerCase()) ?? null
}
