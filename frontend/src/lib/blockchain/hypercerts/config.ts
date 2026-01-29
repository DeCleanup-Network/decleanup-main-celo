export const HYPERCERTS_CONFIG = {
  aggregationModel: 'PER_USER' as const,

  thresholds: {
    production: {
      minCleanups: 10,
      minReports: 1,
    },
    testing: {
      minCleanups: 1,
      minReports: 1,
    },
  },

  metadata: {
    version: 'v1',
    allowNarrative: true,
  },

  // Contract configuration
  contract: {
    // Celo Sepolia testnet contract
    address: '0x8610fe3190E21bf090c9F463b162A76478A88F5F' as `0x${string}`,
    chainId: 44787, // Celo Sepolia
  },

  // Network configuration
  network: {
    name: 'celo-sepolia',
    rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
  },
}