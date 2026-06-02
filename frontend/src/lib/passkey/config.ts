import 'server-only'

function hostnameFromUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null
  try {
    return new URL(url.trim()).hostname || null
  } catch {
    return null
  }
}

function collectAppUrls(): string[] {
  return [
    process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_WEB_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_APP_HOST?.startsWith('http')
      ? process.env.NEXT_PUBLIC_APP_HOST
      : process.env.NEXT_PUBLIC_APP_HOST
        ? `https://${process.env.NEXT_PUBLIC_APP_HOST.trim()}`
        : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : undefined,
  ].filter((v): v is string => Boolean(v?.trim()))
}

/** Relying party display name shown in biometric prompts. */
export function getWebAuthnRpName(): string {
  return process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME?.trim() || 'DeCleanup Rewards'
}

/** RP ID must match the browser hostname (e.g. dapp.decleanup.net). */
export function getWebAuthnRpId(): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID?.trim()) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID.trim()
  }
  for (const url of collectAppUrls()) {
    const host = hostnameFromUrl(url)
    if (host && host !== 'localhost') return host
  }
  if (process.env.NODE_ENV === 'development') return 'localhost'
  const fromHost = process.env.NEXT_PUBLIC_APP_HOST?.trim()
  if (fromHost && !fromHost.includes('/')) return fromHost
  return 'localhost'
}

/** Primary origin for WebAuthn verification. */
export function getWebAuthnOrigin(): string {
  if (process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN?.trim()) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN.trim().replace(/\/$/, '')
  }
  for (const url of collectAppUrls()) {
    if (!url?.trim()) continue
    try {
      const u = new URL(url.trim())
      return u.origin
    } catch {
      /* skip */
    }
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return `https://${getWebAuthnRpId()}`
}

export function getWebAuthnOrigins(): string[] {
  const origins = new Set<string>()
  const add = (url: string | undefined) => {
    if (!url?.trim()) return
    try {
      origins.add(new URL(url.trim()).origin)
    } catch {
      /* skip */
    }
  }
  add(getWebAuthnOrigin())
  for (const url of collectAppUrls()) add(url)
  if ([...origins].some((o) => o.includes('localhost'))) {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }
  return [...origins]
}
