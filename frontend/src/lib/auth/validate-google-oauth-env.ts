import 'server-only'

const GOOGLE_CLIENT_ID_PATTERN =
  /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i

/** Warn in dev when Google OAuth env looks misconfigured (common cause of invalid_client). */
export function warnIfGoogleOAuthMisconfigured(): void {
  if (process.env.NODE_ENV === 'production') return

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) return

  if (!GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
    console.warn(
      '[auth] GOOGLE_CLIENT_ID does not look like a Google OAuth Web client ID. ' +
        'Expected format: 123456789012-abc....apps.googleusercontent.com ' +
        '(from Google Cloud Console → Credentials → OAuth 2.0 Client IDs). ' +
        'invalid_client usually means wrong or deleted client ID.'
    )
  }

  if (!process.env.AUTH_URL?.trim() && !process.env.NEXTAUTH_URL?.trim()) {
    console.warn(
      '[auth] Set AUTH_URL=http://localhost:3000 in .env.local (Auth.js v5 callback base URL).'
    )
  }
}
