import { HypercertMetadataInput } from './types'

export function buildHypercertMetadata(input: HypercertMetadataInput) {
  return {
    version: input.version,
    issuer: input.issuer,
    user: input.userAddress,

    impact: {
      cleanups: input.cleanups.map(c => ({
        id: c.cleanupId,
        verifiedAt: c.verifiedAt,
      })),
      summary: input.summary,
    },

    branding: input.branding ?? null,
    narrative: input.narrative ?? null,

    generatedAt: Date.now(),
  }
}