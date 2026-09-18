/** Celo mainnet cUSD (bridged / native stable). */
export const CUSD_CELO_MAINNET_ADDRESS =
  '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const

export const CELO_MAINNET_CHAIN_ID = 42220

/** Minimal ERC-20 ABI for balance + transfer. */
export const CUSD_ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

export function isMiniPayInjected(): boolean {
  if (typeof window === 'undefined') return false
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum
  return Boolean(eth?.isMiniPay)
}
