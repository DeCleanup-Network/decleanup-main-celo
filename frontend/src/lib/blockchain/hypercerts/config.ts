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
    chainId: 11142220, // Celo Sepolia (44787 is Optimism Sepolia)
  },

  // Network configuration
  network: {
    name: 'celo-sepolia',
    rpcUrl: 'https://celo-sepolia.drpc.org',
  },
}