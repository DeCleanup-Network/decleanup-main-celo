/**
 * Hypercert eligibility thresholds and AT Protocol (Hypercerts v2) configuration.
 */

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
}

export function isAtProtoEnabled(): boolean {
  return process.env.HYPERCERTS_AT_ENABLED === 'true'
}

export function isAtProtoUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HYPERCERTS_AT_ENABLED === 'true'
}

export function getAtProtoPdsUrl(): string {
  return process.env.HYPERCERTS_ATPROTO_PDS_URL || 'https://pds.certified.app'
}

export function getAtProtoOrgDid(): string {
  return process.env.HYPERCERTS_ATPROTO_DID || ''
}

export function getAtProtoHandle(): string {
  return process.env.HYPERCERTS_ATPROTO_HANDLE || ''
}

export function getAtProtoAppPassword(): string {
  return process.env.ATPROTO_APP_PASSWORD || ''
}

/** Returns a user-facing error when AT publish env is incomplete. */
export function getAtProtoConfigError(): string | null {
  if (!isAtProtoEnabled()) return 'ATProto publishing is disabled (HYPERCERTS_AT_ENABLED is not true).'
  if (!getAtProtoOrgDid().trim()) return 'HYPERCERTS_ATPROTO_DID is not set on the server.'
  if (!getAtProtoHandle().trim()) return 'HYPERCERTS_ATPROTO_HANDLE is not set on the server.'
  if (!getAtProtoAppPassword().trim()) return 'ATPROTO_APP_PASSWORD is not set on the server.'
  return null
}
