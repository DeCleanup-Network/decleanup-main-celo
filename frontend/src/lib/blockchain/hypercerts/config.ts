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

/** Bluesky handle resolver — works for accounts on any federated PDS. */
const DEFAULT_BSKY_RESOLVER = 'https://bsky.social'
/** Certified production ePDS — for `*.certified.one` handles only. */
const DEFAULT_CERTIFIED_PDS = 'https://certified.one'

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
export function normalizeAtProtoServiceUrl(raw?: string): string | null {
  const trimmed = stripEnvQuotes(raw ?? '')
  if (!trimmed || trimmed === 'https://' || trimmed === 'http://') {
    return null
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    if (!parsed.hostname) {
      return null
    }
    return candidate
  } catch {
    return null
  }
}

/**
 * AT login / handle-resolver entry point for CredentialSession.
 * Explicit env wins; otherwise inferred from handle suffix.
 * @see https://docs.hypercerts.org/reference/certified-pdss
 */
export function getAtProtoLoginService(): string {
  const loginService = normalizeAtProtoServiceUrl(process.env.HYPERCERTS_ATPROTO_LOGIN_SERVICE)
  if (loginService) return loginService

  const pdsUrl = normalizeAtProtoServiceUrl(process.env.HYPERCERTS_ATPROTO_PDS_URL)
  if (pdsUrl) return pdsUrl

  const handle = getAtProtoHandle().trim().toLowerCase()
  if (handle.endsWith('.certified.one')) {
    return DEFAULT_CERTIFIED_PDS
  }

  return DEFAULT_BSKY_RESOLVER
}

/** @deprecated Use getAtProtoLoginService — kept for diagnostic backward compatibility. */
export function getAtProtoPdsUrl(): string {
  return getAtProtoLoginService()
}

function getAtProtoServiceUrlConfigError(envKey: string, raw?: string): string | null {
  const stripped = raw ? stripEnvQuotes(raw.trim()) : ''
  if (!stripped) return null
  if (/^(true|false)$/i.test(stripped)) {
    return `${envKey} is set to "true" or "false". Use a URL like https://bsky.social or https://certified.one.`
  }
  const normalized = normalizeAtProtoServiceUrl(stripped)
  if (!normalized) {
    return `${envKey} is not a valid URL (use https://bsky.social, https://certified.one, or https://dev.certified.app).`
  }
  return null
}

export function getAtProtoLoginServiceConfigError(): string | null {
  return (
    getAtProtoServiceUrlConfigError(
      'HYPERCERTS_ATPROTO_LOGIN_SERVICE',
      process.env.HYPERCERTS_ATPROTO_LOGIN_SERVICE,
    ) ??
    getAtProtoServiceUrlConfigError('HYPERCERTS_ATPROTO_PDS_URL', process.env.HYPERCERTS_ATPROTO_PDS_URL)
  )
}

/** @deprecated Use getAtProtoLoginServiceConfigError */
export function getAtProtoPdsUrlConfigError(): string | null {
  return getAtProtoLoginServiceConfigError()
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
  const loginServiceError = getAtProtoLoginServiceConfigError()
  if (loginServiceError) return loginServiceError
  if (!getAtProtoOrgDid().trim()) return 'HYPERCERTS_ATPROTO_DID is not set on the server.'
  if (!getAtProtoHandle().trim()) return 'HYPERCERTS_ATPROTO_HANDLE is not set on the server.'
  if (!getAtProtoAppPassword().trim()) return 'ATPROTO_APP_PASSWORD is not set on the server.'
  return null
}
