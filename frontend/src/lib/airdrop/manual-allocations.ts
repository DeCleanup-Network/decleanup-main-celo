import type { Address } from 'viem'
import { GIVETH_DONOR_WALLET_ADDRESSES } from '@/lib/airdrop/giveth-donors'

export type AirdropAllocation = {
  walletAddress: Address
  amountCdcu: string
  category: string
  label: string
}

const GIVETH_DONOR_ALLOCATIONS: readonly AirdropAllocation[] = GIVETH_DONOR_WALLET_ADDRESSES.map(
  (walletAddress) => ({
    walletAddress,
    amountCdcu: '250',
    category: 'giveth_donors',
    label: 'Giveth donor, $cDCU airdrop',
  })
)

/** Past contributors (250 cDCU each). Use signer EOA — same address as MetaMask / gardens.fund. */
const PAST_CONTRIBUTOR_ALLOCATIONS: readonly AirdropAllocation[] = [
  {
    walletAddress: '0xEf0862aE5175dF25E59Db4E9115Fb6987Cf4B779',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xCa0349e71C30C888919F4E6B2e40C9550888e805',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0x46524951c7cCDf154578522F765f2D42d02ca7a4',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0x2291ef1573d9FdAE4E4cd092aD4031f7301f5b5e',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0x173D87dfa68aEB0E821C6021f5652B9C3a7556b4',
    amountCdcu: '200',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xd57289ea98c9e668d2a139e9953742d6bdfef576',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xF6ea014f47cF04FF218139C316a40Fe2854b3690',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xB11ab239fFcE16716442Ad2Bb4ad24A76bc2a6BC',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0xFc8c08681aB2aCb8b48205030B0AFFED436813bB',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
  {
    walletAddress: '0x6aD87d0b36d3449d7c844051d92115f087867D85',
    amountCdcu: '250',
    category: 'past_contributor',
    label: 'Past contributor, $cDCU airdrop',
  },
] as const

/** Other manual rows (not in Giveth list). Giveth addresses override via map merge order. */
const OTHER_MANUAL_ALLOCATIONS: readonly AirdropAllocation[] = [...PAST_CONTRIBUTOR_ALLOCATIONS] as const

/**
 * Temporary manual list until CSV import is ready.
 * Matching is case-insensitive (lowercase keys in map).
 * Later entries win on duplicate addresses (Giveth list applied after OTHER).
 */
export const MANUAL_AIRDROP_ALLOCATIONS: readonly AirdropAllocation[] = [
  ...OTHER_MANUAL_ALLOCATIONS,
  ...GIVETH_DONOR_ALLOCATIONS,
] as const

const allocationMap = new Map<string, AirdropAllocation>(
  MANUAL_AIRDROP_ALLOCATIONS.map((row) => [row.walletAddress.toLowerCase(), row])
)

export function getAirdropAllocation(address: string): AirdropAllocation | null {
  return allocationMap.get(address.toLowerCase()) ?? null
}
