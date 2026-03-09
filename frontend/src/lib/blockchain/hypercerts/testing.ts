/**
 * Testing mode must be derived from the ACTIVE wallet chain,
 * never from env vars (which are static at build time).
 */
export function isTestingMode(chainId?: number): boolean {
  return chainId === 44787 // Celo Sepolia
}