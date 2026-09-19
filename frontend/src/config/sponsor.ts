/**
 * Sponsor / event-funding rules.
 * Keep in sync with server checks in /api/sponsor/events.
 */
export const SPONSOR_CONFIG = {
  /** Impact Product level required to propose an event for community cUSD funding. */
  minLevelToPropose: 1,

  /** Max length for "Why do you need funding?" */
  whyFundingMaxChars: 1000,

  /** Min $cDCU balance for Gardens governance (vote + propose). */
  gardensMinCdcu: 250,

  links: {
    gardensCommunity:
      'https://app.gardens.fund/gardens/42161/0x912ce59144191c1204e64559fe8253a0e49e6548/0x5396c94ea47916f5661734fee769d0d7cc8b14c6',
    gardensHome: 'https://app.gardens.fund',
    coordinatorPlaybook:
      'https://paragraph.com/@decleanupnet/how-to-run-a-verified-cleanup-campaign-the-coordinator-playbook',
    litepaper: 'https://decleanup.net/litepaper',
    airdrop: '/airdrop',
    cleanup: '/cleanup',
    twitterDeCleanup: 'https://x.com/DeCleanupNet',
    twitterEthForTheWorld: 'https://x.com/ETHForTheWorld',
  },
} as const
