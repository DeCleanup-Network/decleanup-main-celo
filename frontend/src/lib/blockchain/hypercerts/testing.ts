export function isTestingMode(): boolean {
  // safest possible v1 condition
  return process.env.NEXT_PUBLIC_CHAIN_ID === '44787' // Celo Sepolia
}