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

const DEFAULT_AT_PDS_URL = 'https://pds.certified.app'

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/** Ensures a valid absolute URL for @atproto/api (requires http(s) scheme + hostname). */
export function normalizeAtProtoPdsUrl(raw?: string): string {
  const trimmed = stripEnvQuotes(raw ?? '')
  if (!trimmed || trimmed === 'https://' || trimmed === 'http://') {
    return DEFAULT_AT_PDS_URL
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_AT_PDS_URL
    }
    if (!parsed.hostname) {
      return DEFAULT_AT_PDS_URL
    }
    return candidate
  } catch {
    return DEFAULT_AT_PDS_URL
  }
}

export function getAtProtoPdsUrl(): string {
  return normalizeAtProtoPdsUrl(process.env.HYPERCERTS_ATPROTO_PDS_URL)
}

export function getAtProtoPdsUrlConfigError(): string | null {
  const raw = process.env.HYPERCERTS_ATPROTO_PDS_URL?.trim()
  const stripped = raw ? stripEnvQuotes(raw) : ''
  if (stripped && /^(true|false)$/i.test(stripped)) {
    return (
      'HYPERCERTS_ATPROTO_PDS_URL is set to "true" or "false". ' +
      'That is a boolean flag mistake — set it to the PDS URL: https://pds.certified.app'
    )
  }

  const normalized = getAtProtoPdsUrl()
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'HYPERCERTS_ATPROTO_PDS_URL must use http or https.'
    }
    if (!url.hostname || url.hostname === 'true' || url.hostname === 'false') {
      return 'HYPERCERTS_ATPROTO_PDS_URL must be a real PDS host (https://pds.certified.app).'
    }
    if (raw && normalized === DEFAULT_AT_PDS_URL && stripped !== DEFAULT_AT_PDS_URL) {
      return `HYPERCERTS_ATPROTO_PDS_URL looks invalid ("${stripped}"). Use https://pds.certified.app`
    }
    return null
  } catch {
    return 'HYPERCERTS_ATPROTO_PDS_URL is not a valid URL (use https://pds.certified.app).'
  }
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
  const pdsError = getAtProtoPdsUrlConfigError()
  if (pdsError) return pdsError
  if (!getAtProtoOrgDid().trim()) return 'HYPERCERTS_ATPROTO_DID is not set on the server.'
  if (!getAtProtoHandle().trim()) return 'HYPERCERTS_ATPROTO_HANDLE is not set on the server.'
  if (!getAtProtoAppPassword().trim()) return 'ATPROTO_APP_PASSWORD is not set on the server.'
  return null
}
