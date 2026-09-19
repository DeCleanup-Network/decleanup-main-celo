/**
 * Normalise an Auth.js callbackUrl to a same-origin app path.
 *
 * Auth.js falls back to `window.location.href` whenever a sign-in call omits a target, so a
 * failed attempt on /login can store the login URL itself as the callback. Sending people back
 * there nests `?callbackUrl=` one level deeper on every round. Absolute URLs from other origins
 * are dropped as well, so a crafted callbackUrl cannot bounce users off the dApp.
 */
function allowedOrigins(explicit?: string): string[] {
  const origins = new Set<string>()
  if (explicit) {
    try {
      origins.add(new URL(explicit).origin)
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') origins.add(window.location.origin)
  for (const key of ['AUTH_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL'] as const) {
    const value = process.env[key]?.trim()
    if (!value) continue
    try {
      origins.add(new URL(value).origin)
    } catch {
      /* ignore */
    }
  }
  return [...origins]
}

function isLoginPath(path: string): boolean {
  return path === '/login' || path.startsWith('/login?') || path.startsWith('/login/')
}

export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = '/',
  allowedOrigin?: string
): string {
  if (!raw) return fallback

  let path = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const origins = allowedOrigins(allowedOrigin)
      if (origins.length > 0 && !origins.includes(url.origin)) return fallback
      path = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return fallback
    }
  }

  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  if (isLoginPath(path)) return fallback
  return path
}

/** Full URL for Auth.js `callbacks.redirect`. */
export function safeRedirectUrl(url: string, baseUrl: string): string {
  const path = safeCallbackUrl(url, '/', baseUrl)
  return new URL(path, baseUrl).toString()
}
