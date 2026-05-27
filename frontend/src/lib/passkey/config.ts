import 'server-only'

/** Relying party display name shown in biometric prompts. */
export function getWebAuthnRpName(): string {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME?.trim() || 'DeCleanup Rewards'
}

/** RP ID must match the site hostname (localhost in dev). */
export function getWebAuthnRpId(): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID?.trim()) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID.trim()
  }
  if (process.env.NODE_ENV === 'development') return 'localhost'
  return process.env.NEXT_PUBLIC_APP_HOST?.trim() || 'localhost'
}

/** Allowed origins for WebAuthn verification. */
export function getWebAuthnOrigin(): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN?.trim()) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN.trim()
  }
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return `https://${getWebAuthnRpId()}`
}

export function getWebAuthnOrigins(): string[] {
  const primary = getWebAuthnOrigin()
  const origins = new Set<string>([primary])
  if (primary.includes('localhost')) {
    origins.add('http://127.0.0.1:3000')
  }
  return [...origins]
}
