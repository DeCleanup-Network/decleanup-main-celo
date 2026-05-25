/** Self-hosted AA auth (Auth.js + client wallets) when core secrets are set. */
export function isAaAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET?.trim() && process.env.DATABASE_URL?.trim())
}

export function isAaAuthEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_AA_AUTH_ENABLED === 'true'
}
